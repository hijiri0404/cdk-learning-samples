// 📚 TypeScript学習ポイント: ファイルアップロードシステム用import
// ファイル処理に特化したAWSサービスのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// S3（ファイルストレージ）
import * as s3 from 'aws-cdk-lib/aws-s3';
// Lambda（ファイル処理関数）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// API Gateway（ファイルアップロード用API）
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// S3イベント（ファイルアップロード時の自動処理）
import * as s3notifications from 'aws-cdk-lib/aws-s3-notifications';
// CloudFormation（カスタムリソース）
import * as cr from 'aws-cdk-lib/custom-resources';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';

// 📚 TypeScript学習ポイント: 詳細な設定インターフェース
// ファイルアップロードシステムの様々な設定を型安全に定義
interface FileUploadStackProps extends cdk.StackProps {
  // プロジェクト名（バケット名などに使用）
  projectName?: string;
  // 環境名（dev, staging, prod等）
  environment?: string;
  // 許可するファイルサイズ（MB単位）
  maxFileSizeMB?: number;
  // 許可するファイル形式（拡張子の配列）
  allowedFileTypes?: string[];
  // ファイル保持期間（日数）
  fileRetentionDays?: number;
  // ウイルススキャンを有効にするか
  enableVirusScan?: boolean;
  // 画像の自動リサイズを有効にするか
  enableImageResize?: boolean;
}

// 📚 TypeScript学習ポイント: ファイルアップロードスタッククラス
export class FileUploadStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly uploadApiUrl: string;
  public readonly downloadApiUrl: string;
  public readonly uploadBucketName: string;
  public readonly processedBucketName: string;

  constructor(scope: Construct, id: string, props: FileUploadStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の詳細設定
    const projectName = props.projectName || 'file-upload-system';
    const environment = props.environment || 'dev';
    const maxFileSizeMB = props.maxFileSizeMB || 10;
    const allowedFileTypes = props.allowedFileTypes || ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx'];
    const fileRetentionDays = props.fileRetentionDays || 30;
    const enableVirusScan = props.enableVirusScan || false;
    const enableImageResize = props.enableImageResize || true;

    // 📚 TypeScript学習ポイント: 名前の動的生成
    const uploadBucketName = `${projectName}-upload-${environment}-${this.account}`;
    const processedBucketName = `${projectName}-processed-${environment}-${this.account}`;

    // 🗄️ アップロード用S3バケット（一時保存）
    // 📚 AWS学習ポイント: ファイルアップロード専用バケット
    const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      bucketName: uploadBucketName,
      
      // 📚 AWS学習ポイント: CORS設定（クロスオリジンアップロード対応）
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],  // 本番環境では特定ドメインに制限
          exposedHeaders: ['ETag'],
        },
      ],
      
      // 📚 AWS学習ポイント: ライフサイクルルール（自動削除）
      lifecycleRules: [
        {
          id: 'DeleteTempFiles',
          enabled: true,
          // 一定期間後に自動削除（コスト削減）
          expiration: cdk.Duration.days(fileRetentionDays),
        },
        {
          id: 'TransitionToIA',
          enabled: true,
          // 7日後に低頻度アクセスストレージに移行
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7),
            },
          ],
        },
      ],
      
      // 📚 AWS学習ポイント: バージョニング（誤削除対策）
      versioned: true,
      
      // パブリックアクセスをブロック（セキュリティ）
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      // 学習用設定
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 🗄️ 処理済みファイル用S3バケット
    const processedBucket = new s3.Bucket(this, 'ProcessedBucket', {
      bucketName: processedBucketName,
      
      // 📚 AWS学習ポイント: 静的ウェブサイトホスティング設定
      websiteIndexDocument: 'index.html',
      
      // 処理済みファイルは公開可能
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      
      // より長期間の保存
      lifecycleRules: [
        {
          id: 'TransitionToGlacier',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ⚡ ファイル処理用Lambda関数
    // 📚 AWS学習ポイント: S3イベント駆動の処理関数
    const fileProcessorFunction = new lambda.Function(this, 'FileProcessor', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'file_processor.lambda_handler',
      code: lambda.Code.fromAsset('./samples/03-file-upload-system/lambda'),
      
      // 📚 AWS学習ポイント: ファイル処理に適した設定
      timeout: cdk.Duration.minutes(5),  // ファイル処理は時間がかかる場合がある
      memorySize: 1024,                  // 画像処理等でメモリを多めに確保
      
      // 環境変数の設定
      environment: {
        UPLOAD_BUCKET: uploadBucket.bucketName,
        PROCESSED_BUCKET: processedBucket.bucketName,
        MAX_FILE_SIZE_MB: maxFileSizeMB.toString(),
        ALLOWED_FILE_TYPES: allowedFileTypes.join(','),
        ENABLE_VIRUS_SCAN: enableVirusScan.toString(),
        ENABLE_IMAGE_RESIZE: enableImageResize.toString(),
      },
    });

    // ⚡ API用Lambda関数
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'api_handler.lambda_handler',
      code: lambda.Code.fromAsset('./samples/03-file-upload-system/lambda'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        UPLOAD_BUCKET: uploadBucket.bucketName,
        PROCESSED_BUCKET: processedBucket.bucketName,
        MAX_FILE_SIZE_MB: maxFileSizeMB.toString(),
        ALLOWED_FILE_TYPES: allowedFileTypes.join(','),
      },
    });

    // 📚 AWS学習ポイント: IAM権限の付与
    // Lambda関数にS3バケットへのアクセス権限を付与
    uploadBucket.grantReadWrite(fileProcessorFunction);
    processedBucket.grantReadWrite(fileProcessorFunction);
    uploadBucket.grantReadWrite(apiFunction);
    processedBucket.grantRead(apiFunction);

    // 📚 AWS学習ポイント: S3の署名付きURL生成権限
    // ファイルアップロード用の一時的な署名付きURLを生成する権限
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:PutObjectAcl'],
      resources: [`${uploadBucket.bucketArn}/*`],
    }));

    // 📚 AWS学習ポイント: S3イベント通知の設定
    // ファイルがアップロードされた時にLambda関数を自動実行
    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,  // オブジェクト作成時
      new s3notifications.LambdaDestination(fileProcessorFunction),
      { prefix: 'uploads/' }  // uploads/フォルダ内のファイルのみ
    );

    // 🌐 API Gatewayの作成
    const api = new apigateway.RestApi(this, 'FileUploadApi', {
      restApiName: `${projectName}-api-${environment}`,
      description: 'File Upload and Management API',
      
      // 📚 AWS学習ポイント: バイナリメディアタイプ設定
      // ファイルアップロードに必要な設定
      binaryMediaTypes: ['*/*'],
      
      deployOptions: {
        stageName: environment,
      },
      
      // CORS設定
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
      },
    });

    // 📚 TypeScript学習ポイント: API統合の作成
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // 📚 API設計学習ポイント: ファイル管理APIのエンドポイント設計

    // /upload エンドポイント（署名付きURL取得）
    const uploadResource = api.root.addResource('upload');
    uploadResource.addMethod('POST', lambdaIntegration, {
      operationName: 'GetUploadUrl',
    });

    // /files エンドポイント（ファイル一覧・管理）
    const filesResource = api.root.addResource('files');
    
    // GET /files - ファイル一覧取得
    filesResource.addMethod('GET', lambdaIntegration, {
      operationName: 'ListFiles',
    });
    
    // GET /files/{fileId} - ファイル情報取得
    const fileResource = filesResource.addResource('{fileId}');
    fileResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetFile',
    });
    
    // DELETE /files/{fileId} - ファイル削除
    fileResource.addMethod('DELETE', lambdaIntegration, {
      operationName: 'DeleteFile',
    });

    // /download エンドポイント（ダウンロード用署名付きURL）
    const downloadResource = api.root.addResource('download');
    const downloadFileResource = downloadResource.addResource('{fileId}');
    downloadFileResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetDownloadUrl',
    });

    // /status エンドポイント（処理状況確認）
    const statusResource = api.root.addResource('status');
    const statusFileResource = statusResource.addResource('{fileId}');
    statusFileResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetProcessingStatus',
    });

    // 📚 TypeScript学習ポイント: プロパティへの値の代入
    this.uploadApiUrl = api.url;
    this.downloadApiUrl = `${api.url}download/`;
    this.uploadBucketName = uploadBucket.bucketName;
    this.processedBucketName = processedBucket.bucketName;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'UploadApiUrl', {
      value: api.url,
      description: 'ファイルアップロードAPI のベースURL',
    });

    new cdk.CfnOutput(this, 'UploadBucketName', {
      value: uploadBucket.bucketName,
      description: 'アップロード用S3バケット名',
    });

    new cdk.CfnOutput(this, 'ProcessedBucketName', {
      value: processedBucket.bucketName,
      description: '処理済みファイル用S3バケット名',
    });

    new cdk.CfnOutput(this, 'ProcessedBucketWebsiteUrl', {
      value: processedBucket.bucketWebsiteUrl,
      description: '処理済みファイルの公開URL',
    });

    // 📚 便利な出力: 各種エンドポイントURL
    new cdk.CfnOutput(this, 'UploadEndpoint', {
      value: `${api.url}upload`,
      description: 'ファイルアップロード用エンドポイント',
    });

    new cdk.CfnOutput(this, 'FilesEndpoint', {
      value: `${api.url}files`,
      description: 'ファイル管理エンドポイント',
    });

    new cdk.CfnOutput(this, 'WebInterfaceUrl', {
      value: `${processedBucket.bucketWebsiteUrl}`,
      description: 'ウェブインターフェースURL（デプロイ後にindex.htmlをアップロード）',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ 配列操作: allowedFileTypes.join(',')
    // ✅ 数値と文字列変換: number.toString()
    // ✅ 複雑なオブジェクト設定: CORS, ライフサイクルルール
    // ✅ 条件付き設定: enableXxx ? 設定 : undefined
    // ✅ 多段階リソース作成: バケット → 権限 → 通知設定
    // ✅ 環境変数配列: { KEY: value.toString() }

    // 📚 AWS学習まとめ（このファイルで学んだ新しいサービス・概念）:
    // ✅ S3 CORS: クロスオリジンリクエスト対応
    // ✅ S3 ライフサイクル: 自動的なストレージクラス変更・削除
    // ✅ S3 イベント通知: オブジェクト作成時の自動処理
    // ✅ Lambda イベント駆動: S3イベントによる自動実行
    // ✅ IAM Policy Statement: 詳細な権限制御
    // ✅ API Gateway バイナリメディア: ファイルアップロード対応
    // ✅ 署名付きURL: セキュアなファイルアップロード・ダウンロード
  }
}