// 📚 TypeScript学習ポイント: 画像処理サービス用import
// 画像リサイズとパフォーマンス最適化に特化したライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// S3（画像ストレージ）
import * as s3 from 'aws-cdk-lib/aws-s3';
// Lambda（画像処理関数）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// S3イベント（画像アップロード時の自動処理）
import * as s3notifications from 'aws-cdk-lib/aws-s3-notifications';
// CloudFront（CDN配信）
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// DynamoDB（メタデータ管理）
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// SNS（処理完了通知）
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// SQS（キューイング）
import * as sqs from 'aws-cdk-lib/aws-sqs';
// CloudWatch（監視）
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';

// 📚 TypeScript学習ポイント: 画像リサイズサービス設定インターフェース
// 画像処理の詳細設定とパフォーマンス調整を型安全に定義
interface ImageResizeStackProps extends cdk.StackProps {
  // プロジェクト名
  projectName?: string;
  // 環境名（dev, staging, prod等）
  environment?: string;
  // リサイズ品質（1-100、高いほど高品質・大容量）
  imageQuality?: number;
  // 生成する画像サイズ配列
  imageSizes?: ImageSize[];
  // WebP変換を有効にするか
  enableWebPConversion?: boolean;
  // メタデータ保持を有効にするか
  preserveMetadata?: boolean;
  // 通知メールアドレス
  notificationEmail?: string;
  // 自動削除期間（日数）
  originalImageRetentionDays?: number;
}

// 📚 TypeScript学習ポイント: カスタム型定義
// 画像サイズ設定の構造を定義
interface ImageSize {
  name: string;      // サイズ名（例: thumbnail, medium, large）
  width: number;     // 幅（ピクセル）
  height: number;    // 高さ（ピクセル）
  quality?: number;  // 品質（サイズ別に調整可能）
}

// 📚 TypeScript学習ポイント: 画像リサイズメインクラス
export class ImageResizeStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly originalBucketName: string;
  public readonly resizedBucketName: string;
  public readonly distributionDomainName: string;
  public readonly notificationTopicArn: string;

  constructor(scope: Construct, id: string, props: ImageResizeStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の詳細設定
    const projectName = props.projectName || 'image-resize-service';
    const environment = props.environment || 'dev';
    const imageQuality = props.imageQuality || 85;
    const enableWebPConversion = props.enableWebPConversion !== false; // デフォルトtrue
    const preserveMetadata = props.preserveMetadata || false;
    const originalImageRetentionDays = props.originalImageRetentionDays || 90;
    
    // 📚 TypeScript学習ポイント: 配列のデフォルト値設定
    const imageSizes: ImageSize[] = props.imageSizes || [
      { name: 'thumbnail', width: 150, height: 150, quality: 80 },
      { name: 'small', width: 400, height: 300, quality: 85 },
      { name: 'medium', width: 800, height: 600, quality: 90 },
      { name: 'large', width: 1200, height: 900, quality: 95 },
      { name: 'xlarge', width: 1920, height: 1080, quality: 95 },
    ];

    // 📚 TypeScript学習ポイント: 動的リソース名生成
    const originalBucketName = `${projectName}-original-${environment}-${this.account}`;
    const resizedBucketName = `${projectName}-resized-${environment}-${this.account}`;

    // 🗄️ オリジナル画像用S3バケット
    // 📚 AWS学習ポイント: 画像アップロード専用バケット
    const originalBucket = new s3.Bucket(this, 'OriginalImageBucket', {
      bucketName: originalBucketName,
      
      // 📚 AWS学習ポイント: CORS設定（ウェブアプリからの直接アップロード対応）
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // 本番環境では特定ドメインに制限
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      
      // 📚 AWS学習ポイント: インテリジェント階層化（コスト最適化）
      lifecycleRules: [
        {
          id: 'OptimizeStorage',
          enabled: true,
          // 30日後に低頻度アクセスストレージへ移行
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          // 指定期間後に自動削除
          expiration: cdk.Duration.days(originalImageRetentionDays),
        },
        {
          id: 'DeleteIncompleteMultipart',
          enabled: true,
          // 未完了のマルチパートアップロードを削除
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      
      // 📚 AWS学習ポイント: 通知設定の準備
      eventBridgeEnabled: true,
      
      // パブリックアクセスをブロック（セキュリティ）
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      // 学習用設定
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 🗄️ リサイズ済み画像用S3バケット
    const resizedBucket = new s3.Bucket(this, 'ResizedImageBucket', {
      bucketName: resizedBucketName,
      
      // 📚 AWS学習ポイント: ウェブサイトホスティング設定
      websiteIndexDocument: 'index.html',
      
      // リサイズ済み画像は公開配信
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      
      // 📚 AWS学習ポイント: 自動的なストレージクラス変更
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(60),
            },
          ],
        },
      ],
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 📊 画像メタデータ管理用DynamoDBテーブル
    // 📚 AWS学習ポイント: 画像情報とリサイズ状況の管理
    const imageMetadataTable = new dynamodb.Table(this, 'ImageMetadataTable', {
      tableName: `${projectName}-metadata-${environment}`,
      
      // プライマリキー：画像ID
      partitionKey: {
        name: 'imageId',
        type: dynamodb.AttributeType.STRING,
      },
      
      // ソートキー：リサイズ種別
      sortKey: {
        name: 'sizeType',
        type: dynamodb.AttributeType.STRING,
      },
      
      // 📚 AWS学習ポイント: オンデマンド課金
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // 📚 AWS学習ポイント: Point-in-Time Recovery（本番環境推奨）
      pointInTimeRecovery: environment === 'prod',
      
      // グローバルセカンダリインデックス（ユーザー別検索用）
      globalSecondaryIndexes: [
        {
          indexName: 'UserIdIndex',
          partitionKey: {
            name: 'userId',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'uploadedAt',
            type: dynamodb.AttributeType.STRING,
          },
        },
      ],
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 📬 SNS通知トピック（処理完了通知）
    const notificationTopic = new sns.Topic(this, 'ImageProcessingNotifications', {
      topicName: `${projectName}-notifications-${environment}`,
      displayName: 'Image Processing Notifications',
    });

    // 📧 メール通知設定（指定されている場合）
    if (props.notificationEmail) {
      notificationTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    // 📦 DLQ（Dead Letter Queue）- 処理失敗時の保管場所
    const dlq = new sqs.Queue(this, 'ImageProcessingDLQ', {
      queueName: `${projectName}-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // 📦 SQSキュー（画像処理の非同期実行用）
    const processingQueue = new sqs.Queue(this, 'ImageProcessingQueue', {
      queueName: `${projectName}-processing-${environment}`,
      
      // 📚 AWS学習ポイント: SQS設定
      visibilityTimeout: cdk.Duration.minutes(15), // Lambda実行時間より長く
      receiveMessageWaitTime: cdk.Duration.seconds(20), // ロングポーリング
      
      // デッドレターキューの設定
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3, // 3回失敗したらDLQに移動
      },
    });

    // ⚡ Sharp画像処理ライブラリのLambdaレイヤー
    // 📚 AWS学習ポイント: カスタムレイヤーの作成
    const sharpLayer = new lambda.LayerVersion(this, 'SharpLayer', {
      layerVersionName: `${projectName}-sharp-layer-${environment}`,
      code: lambda.Code.fromAsset('./samples/05-image-resize/lambda-layers/sharp'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Sharp image processing library for Node.js',
    });

    // ⚡ 画像リサイズ処理用Lambda関数
    // 📚 AWS学習ポイント: 高メモリ・高性能Lambda設定
    const imageResizeFunction = new lambda.Function(this, 'ImageResizeFunction', {
      // Node.js実行環境（Sharp最適化）
      runtime: lambda.Runtime.NODEJS_18_X,
      
      // ハンドラー関数
      handler: 'imageResize.handler',
      
      // ソースコード
      code: lambda.Code.fromInline(`
const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
    console.log('Image resize event:', JSON.stringify(event, null, 2));
    
    const { Records } = event;
    const results = [];
    
    for (const record of Records) {
        try {
            // SQSメッセージまたはS3イベントから画像情報を取得
            const imageInfo = JSON.parse(record.body || JSON.stringify(record.s3));
            const bucket = imageInfo.bucket?.name || process.env.ORIGINAL_BUCKET;
            const key = imageInfo.object?.key || imageInfo.key;
            
            console.log(\`Processing image: \${bucket}/\${key}\`);
            
            // オリジナル画像を取得
            const originalImage = await s3.getObject({
                Bucket: bucket,
                Key: key
            }).promise();
            
            // 画像情報を取得
            const imageBuffer = originalImage.Body;
            const imageMetadata = await sharp(imageBuffer).metadata();
            
            console.log('Image metadata:', imageMetadata);
            
            // 各サイズにリサイズ
            const imageSizes = JSON.parse(process.env.IMAGE_SIZES);
            const resizePromises = imageSizes.map(async (size) => {
                try {
                    // Sharp でリサイズ処理
                    let resizeOperation = sharp(imageBuffer)
                        .resize(size.width, size.height, {
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .jpeg({ quality: size.quality || 85 });
                    
                    // WebP変換が有効な場合
                    if (process.env.ENABLE_WEBP === 'true') {
                        resizeOperation = resizeOperation.webp({ quality: size.quality || 85 });
                    }
                    
                    const resizedImageBuffer = await resizeOperation.toBuffer();
                    
                    // リサイズ済み画像をS3に保存
                    const resizedKey = \`\${size.name}/\${key}\`;
                    await s3.putObject({
                        Bucket: process.env.RESIZED_BUCKET,
                        Key: resizedKey,
                        Body: resizedImageBuffer,
                        ContentType: process.env.ENABLE_WEBP === 'true' ? 'image/webp' : 'image/jpeg',
                        CacheControl: 'max-age=31536000' // 1年間キャッシュ
                    }).promise();
                    
                    // メタデータをDynamoDBに保存
                    await dynamodb.put({
                        TableName: process.env.METADATA_TABLE,
                        Item: {
                            imageId: key,
                            sizeType: size.name,
                            width: size.width,
                            height: size.height,
                            fileSize: resizedImageBuffer.length,
                            contentType: process.env.ENABLE_WEBP === 'true' ? 'image/webp' : 'image/jpeg',
                            processedAt: new Date().toISOString(),
                            originalMetadata: imageMetadata
                        }
                    }).promise();
                    
                    console.log(\`Resized to \${size.name}: \${resizedKey}\`);
                    return { size: size.name, key: resizedKey, success: true };
                    
                } catch (sizeError) {
                    console.error(\`Error resizing to \${size.name}:\`, sizeError);
                    return { size: size.name, error: sizeError.message, success: false };
                }
            });
            
            const resizeResults = await Promise.all(resizePromises);
            
            // 処理完了通知
            await sns.publish({
                TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
                Subject: 'Image Processing Complete',
                Message: JSON.stringify({
                    originalImage: \`\${bucket}/\${key}\`,
                    resizeResults: resizeResults,
                    timestamp: new Date().toISOString()
                })
            }).promise();
            
            results.push({
                image: key,
                resizeResults: resizeResults,
                success: true
            });
            
        } catch (error) {
            console.error('Error processing image:', error);
            results.push({
                error: error.message,
                success: false
            });
        }
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Image processing completed',
            results: results
        })
    };
};
      `),
      
      // 📚 AWS学習ポイント: 画像処理に最適化された設定
      timeout: cdk.Duration.minutes(15),  // 画像処理は時間がかかる
      memorySize: 3008,                   // 最大メモリ（高速処理）
      
      // レイヤー追加
      layers: [sharpLayer],
      
      // 環境変数
      environment: {
        ORIGINAL_BUCKET: originalBucket.bucketName,
        RESIZED_BUCKET: resizedBucket.bucketName,
        METADATA_TABLE: imageMetadataTable.tableName,
        NOTIFICATION_TOPIC_ARN: notificationTopic.topicArn,
        IMAGE_SIZES: JSON.stringify(imageSizes),
        IMAGE_QUALITY: imageQuality.toString(),
        ENABLE_WEBP: enableWebPConversion.toString(),
        PRESERVE_METADATA: preserveMetadata.toString(),
      },
      
      // 📚 AWS学習ポイント: SQSイベントソース
      events: [new lambda.SqsEventSource(processingQueue, {
        batchSize: 1, // 画像処理は1つずつ実行
      })],
    });

    // 📚 AWS学習ポイント: Lambda の S3・DynamoDB・SNS アクセス権限
    originalBucket.grantRead(imageResizeFunction);
    resizedBucket.grantWrite(imageResizeFunction);
    imageMetadataTable.grantWriteData(imageResizeFunction);
    notificationTopic.grantPublish(imageResizeFunction);

    // 📚 AWS学習ポイント: S3イベント → SQS → Lambda パターン
    // S3に画像がアップロードされた時にSQSキューに通知
    originalBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.SqsDestination(processingQueue),
      { prefix: 'uploads/', suffix: '.jpg' }
    );
    
    originalBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.SqsDestination(processingQueue),
      { prefix: 'uploads/', suffix: '.jpeg' }
    );
    
    originalBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.SqsDestination(processingQueue),
      { prefix: 'uploads/', suffix: '.png' }
    );

    // 🌐 CloudFront ディストリビューション（高速配信）
    // 📚 AWS学習ポイント: 画像配信に最適化されたCDN設定
    const distribution = new cloudfront.Distribution(this, 'ImageDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(resizedBucket),
        
        // 📚 AWS学習ポイント: 画像配信最適化
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        
        // 圧縮を有効化
        compress: true,
        
        // 許可するHTTPメソッド
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        
        // HTTPS強制
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      
      // 📚 AWS学習ポイント: 複数の動作設定（サイズ別最適化）
      additionalBehaviors: {
        // サムネイル用（短時間キャッシュ）
        '/thumbnail/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(resizedBucket),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        // 大サイズ画像用（長時間キャッシュ）
        '/large/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(resizedBucket),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      
      // デフォルトルートオブジェクト
      defaultRootObject: 'index.html',
      
      // エラーページ設定
      errorResponses: [
        {
          httpStatus: 404,
          responsePagePath: '/error.html',
          responseHttpStatus: 404,
        },
      ],
      
      // コメント
      comment: `${projectName} image distribution for ${environment}`,
    });

    // 📊 CloudWatch メトリクス・アラーム
    // 📚 AWS学習ポイント: 画像処理システムの監視
    const processingErrorsAlarm = new cloudwatch.Alarm(this, 'ProcessingErrorsAlarm', {
      alarmName: `${projectName}-processing-errors-${environment}`,
      alarmDescription: 'Image processing errors',
      metric: imageResizeFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // アラーム発生時にSNS通知
    processingErrorsAlarm.addAlarmAction(
      new cloudwatch.SnsAction(notificationTopic)
    );

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.originalBucketName = originalBucket.bucketName;
    this.resizedBucketName = resizedBucket.bucketName;
    this.distributionDomainName = distribution.distributionDomainName;
    this.notificationTopicArn = notificationTopic.topicArn;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'OriginalBucketName', {
      value: originalBucket.bucketName,
      description: 'オリジナル画像アップロード用S3バケット名',
    });

    new cdk.CfnOutput(this, 'ResizedBucketName', {
      value: resizedBucket.bucketName,
      description: 'リサイズ済み画像用S3バケット名',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront配信ドメイン名',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront配信URL',
    });

    new cdk.CfnOutput(this, 'MetadataTableName', {
      value: imageMetadataTable.tableName,
      description: '画像メタデータ管理テーブル名',
    });

    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: processingQueue.queueUrl,
      description: '画像処理キューURL',
    });

    // 📚 便利な出力: サイズ別画像URL例
    imageSizes.forEach((size, index) => {
      new cdk.CfnOutput(this, `${size.name}ImageUrlExample`, {
        value: `https://${distribution.distributionDomainName}/${size.name}/uploads/example.jpg`,
        description: `${size.name}サイズ画像のURL例`,
      });
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ カスタム型定義: interface ImageSize
    // ✅ 配列操作: map(), forEach()
    // ✅ 非同期処理: Promise.all()
    // ✅ JSON操作: JSON.stringify(), JSON.parse()
    // ✅ 複雑な環境変数設定: オブジェクト → JSON文字列
    // ✅ 動的リソース作成: 配列に基づく繰り返し処理
    // ✅ Lambda レイヤー: 外部ライブラリの効率的な管理

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ Sharp: Node.js画像処理ライブラリ
    // ✅ Lambda Layers: 共通ライブラリの管理
    // ✅ SQS: 非同期処理キューイング
    // ✅ SNS: プッシュ通知サービス
    // ✅ CloudWatch Alarms: 監視・アラート
    // ✅ CloudFront: CDN配信、キャッシュ最適化
    // ✅ DynamoDB GSI: グローバルセカンダリインデックス
    // ✅ S3 Lifecycle: 自動的なストレージクラス変更
    // ✅ イベント駆動アーキテクチャ: S3 → SQS → Lambda パターン
    // ✅ 高性能画像処理: メモリ最適化、並列処理
  }
}