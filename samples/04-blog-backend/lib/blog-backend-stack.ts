// 📚 TypeScript学習ポイント: ブログバックエンド用import
// RDS、VPC、セキュリティを重視したエンタープライズグレードのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// VPC（ネットワーク基盤）
import * as ec2 from 'aws-cdk-lib/aws-ec2';
// RDS（リレーショナルデータベース）
import * as rds from 'aws-cdk-lib/aws-rds';
// Lambda（サーバーレス関数）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// API Gateway（HTTP API）
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// Secrets Manager（機密情報管理）
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';
// CloudWatch Logs（ログ管理）
import * as logs from 'aws-cdk-lib/aws-logs';

// 📚 TypeScript学習ポイント: ブログシステム設定インターフェース
// エンタープライズ級のブログシステムの詳細設定を型安全に定義
interface BlogBackendStackProps extends cdk.StackProps {
  // プロジェクト名（リソース名のプレフィックス）
  projectName?: string;
  // 環境名（dev, staging, prod等）
  environment?: string;
  // データベースインスタンスクラス
  databaseInstanceClass?: ec2.InstanceType;
  // データベース名
  databaseName?: string;
  // マルチAZ配置を有効にするか（高可用性）
  enableMultiAz?: boolean;
  // バックアップ保持期間（日数）
  backupRetentionDays?: number;
  // 削除保護を有効にするか
  enableDeletionProtection?: boolean;
  // パフォーマンスインサイトを有効にするか
  enablePerformanceInsights?: boolean;
}

// 📚 TypeScript学習ポイント: ブログバックエンドメインクラス
export class BlogBackendStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly apiUrl: string;
  public readonly vpcId: string;
  public readonly databaseEndpoint: string;
  public readonly databaseSecretArn: string;

  constructor(scope: Construct, id: string, props: BlogBackendStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: エンタープライズ設定のデフォルト値
    const projectName = props.projectName || 'blog-backend';
    const environment = props.environment || 'dev';
    const databaseName = props.databaseName || 'blogdb';
    const databaseInstanceClass = props.databaseInstanceClass || ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
    const enableMultiAz = props.enableMultiAz || (environment === 'prod');
    const backupRetentionDays = props.backupRetentionDays || (environment === 'prod' ? 30 : 7);
    const enableDeletionProtection = props.enableDeletionProtection || (environment === 'prod');
    const enablePerformanceInsights = props.enablePerformanceInsights || (environment === 'prod');

    // 🌐 VPCの作成（ネットワーク基盤）
    // 📚 AWS学習ポイント: プライベートネットワークの構築
    const vpc = new ec2.Vpc(this, 'BlogVpc', {
      // VPCの名前
      vpcName: `${projectName}-vpc-${environment}`,
      
      // IPアドレス範囲（RFC 1918プライベート範囲）
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      
      // アベイラビリティーゾーン数（高可用性のため2つ以上）
      maxAzs: 2,
      
      // 📚 AWS学習ポイント: サブネット設計
      subnetConfiguration: [
        {
          // パブリックサブネット（インターネットゲートウェイ接続）
          cidrMask: 24,                    // /24 = 256個のIPアドレス
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          // プライベートサブネット（NATゲートウェイ経由でのみ外部接続）
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          // 分離サブネット（外部接続なし、データベース専用）
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      
      // 📚 AWS学習ポイント: NAT ゲートウェイ設定
      // 本番環境では高可用性のため各AZに配置、開発環境はコスト削減で1つ
      natGateways: environment === 'prod' ? 2 : 1,
      
      // 📚 AWS学習ポイント: VPCエンドポイント（AWS APIへのプライベート接続）
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
        DynamoDB: {
          service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        },
      },
    });

    // 🔒 セキュリティグループの作成
    // 📚 AWS学習ポイント: ファイアウォールルールの定義

    // データベース用セキュリティグループ
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: vpc,
      description: 'Security group for RDS PostgreSQL database',
      securityGroupName: `${projectName}-db-sg-${environment}`,
    });

    // Lambda関数用セキュリティグループ
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Lambda functions',
      securityGroupName: `${projectName}-lambda-sg-${environment}`,
    });

    // 📚 AWS学習ポイント: セキュリティグループルールの設定
    // Lambda → RDS のアクセスを許可（PostgreSQLポート5432）
    databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,              // ソース：Lambda用セキュリティグループ
      ec2.Port.tcp(5432),              // ポート：PostgreSQL
      'Allow access from Lambda functions'
    );

    // 🔐 データベース認証情報の管理
    // 📚 AWS学習ポイント: Secrets Manager による機密情報管理
    const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      // シークレット名
      secretName: `${projectName}-db-credentials-${environment}`,
      
      // 説明
      description: 'Database credentials for blog backend',
      
      // 📚 TypeScript学習ポイント: 自動生成されるランダムパスワード
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'blogadmin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',    // パスワードに含めない文字
        includeSpace: false,             // スペースを含めない
        passwordLength: 32,              // パスワード長
      },
    });

    // 🗄️ RDS PostgreSQLデータベースの作成
    // 📚 AWS学習ポイント: リレーショナルデータベースの構築
    const database = new rds.DatabaseInstance(this, 'BlogDatabase', {
      // データベースエンジン（PostgreSQL最新版）
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      
      // インスタンスクラス（処理能力）
      instanceType: databaseInstanceClass,
      
      // 認証情報（Secrets Manager連携）
      credentials: rds.Credentials.fromSecret(databaseSecret),
      
      // データベース名
      databaseName: databaseName,
      
      // 📚 AWS学習ポイント: ストレージ設定
      allocatedStorage: 20,            // 初期ストレージサイズ（GB）
      maxAllocatedStorage: 100,        // 自動拡張最大サイズ（GB）
      storageType: rds.StorageType.GP3, // General Purpose SSD v3
      
      // 📚 AWS学習ポイント: 高可用性設定
      multiAz: enableMultiAz,          // マルチAZ配置
      
      // 📚 AWS学習ポイント: バックアップ設定
      backupRetention: cdk.Duration.days(backupRetentionDays),
      preferredBackupWindow: '03:00-04:00',      // バックアップ時間（UTC）
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00', // メンテナンス時間
      
      // 📚 AWS学習ポイント: セキュリティ設定
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // 分離サブネットに配置
      },
      securityGroups: [databaseSecurityGroup],
      
      // 削除保護（本番環境では必須）
      deletionProtection: enableDeletionProtection,
      
      // 📚 AWS学習ポイント: 監視・パフォーマンス設定
      monitoringInterval: cdk.Duration.seconds(60), // 拡張モニタリング
      enablePerformanceInsights: enablePerformanceInsights,
      performanceInsightRetention: enablePerformanceInsights 
        ? rds.PerformanceInsightRetention.MONTHS_1 
        : undefined,
      
      // 📚 AWS学習ポイント: ログ設定
      cloudwatchLogsExports: ['postgresql'],
      
      // 学習用設定（本番環境では RETAIN に変更）
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // ⚡ Lambda関数用のレイヤー（共通ライブラリ）
    // 📚 AWS学習ポイント: 依存関係の効率的な管理
    const psycopg2Layer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'Psycopg2Layer',
      // 📚 学習ポイント: パブリックレイヤーの活用
      `arn:aws:lambda:${this.region}:898466741470:layer:psycopg2-py38:2`
    );

    // ⚡ ブログAPI用Lambda関数
    // 📚 AWS学習ポイント: VPC内Lambda関数
    const blogApiFunction = new lambda.Function(this, 'BlogApiFunction', {
      // 実行環境
      runtime: lambda.Runtime.PYTHON_3_11,
      
      // ハンドラー関数
      handler: 'blog_api.lambda_handler',
      
      // ソースコード（予定）
      code: lambda.Code.fromInline(`
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def lambda_handler(event, context):
    # 📚 実装予定: ブログAPI処理
    # - 記事の CRUD 操作
    # - ユーザー認証
    # - コメント機能
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Blog API - Coming Soon!',
            'environment': os.environ.get('ENVIRONMENT', 'unknown')
        })
    }
      `),
      
      // 📚 AWS学習ポイント: VPC内Lambda設定
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // NAT経由で外部接続可能
      },
      securityGroups: [lambdaSecurityGroup],
      
      // 📚 AWS学習ポイント: VPC Lambda のタイムアウト
      timeout: cdk.Duration.minutes(5),  // VPC内は初回起動が遅い場合がある
      memorySize: 512,
      
      // レイヤー追加（PostgreSQL接続ライブラリ）
      layers: [psycopg2Layer],
      
      // 環境変数
      environment: {
        ENVIRONMENT: environment,
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        DATABASE_NAME: databaseName,
      },
      
      // 📚 AWS学習ポイント: ログ設定
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // 📚 AWS学習ポイント: Lambda の RDS アクセス権限
    // Secrets Manager からデータベース認証情報を読み取る権限
    databaseSecret.grantRead(blogApiFunction);
    
    // VPC エンドポイント用権限（Secrets Manager API呼び出し）
    blogApiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret'
      ],
      resources: [databaseSecret.secretArn],
    }));

    // 🌐 API Gateway の作成
    // 📚 AWS学習ポイント: REST API エンドポイント
    const api = new apigateway.RestApi(this, 'BlogApi', {
      // API名
      restApiName: `${projectName}-api-${environment}`,
      
      // 説明
      description: `Blog Backend REST API for ${environment} environment`,
      
      // 📚 AWS学習ポイント: デプロイ設定
      deploy: true,
      deployOptions: {
        stageName: environment,
        // アクセスログの有効化
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiAccessLogs', {
            logGroupName: `/aws/apigateway/${projectName}-${environment}`,
            retention: logs.RetentionDays.TWO_WEEKS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
      
      // 📚 AWS学習ポイント: CORS設定
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // 📚 AWS学習ポイント: Lambda統合の作成
    const lambdaIntegration = new apigateway.LambdaIntegration(blogApiFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // 📚 API設計学習ポイント: RESTful ブログAPI エンドポイント設計

    // ルートパス "/" 
    const rootResource = api.root;

    // "/posts" リソース（ブログ記事）
    const postsResource = rootResource.addResource('posts');
    
    // GET /posts - 記事一覧取得
    postsResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetAllPosts',
      requestParameters: {
        'method.request.querystring.page': false,    // ページング
        'method.request.querystring.limit': false,   // 取得件数
        'method.request.querystring.category': false, // カテゴリフィルタ
      },
    });
    
    // POST /posts - 新規記事作成
    postsResource.addMethod('POST', lambdaIntegration, {
      operationName: 'CreatePost',
    });
    
    // "/posts/{postId}" リソース（個別記事）
    const postResource = postsResource.addResource('{postId}');
    
    // GET /posts/{postId} - 特定記事取得
    postResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetPost',
    });
    
    // PUT /posts/{postId} - 記事更新
    postResource.addMethod('PUT', lambdaIntegration, {
      operationName: 'UpdatePost',
    });
    
    // DELETE /posts/{postId} - 記事削除
    postResource.addMethod('DELETE', lambdaIntegration, {
      operationName: 'DeletePost',
    });

    // "/posts/{postId}/comments" リソース（記事のコメント）
    const commentsResource = postResource.addResource('comments');
    
    // GET /posts/{postId}/comments - コメント一覧
    commentsResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetComments',
    });
    
    // POST /posts/{postId}/comments - コメント投稿
    commentsResource.addMethod('POST', lambdaIntegration, {
      operationName: 'CreateComment',
    });

    // "/users" リソース（ユーザー管理）
    const usersResource = rootResource.addResource('users');
    
    // POST /users - ユーザー登録
    usersResource.addMethod('POST', lambdaIntegration, {
      operationName: 'RegisterUser',
    });
    
    // "/users/{userId}" リソース
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetUser',
    });

    // "/auth" リソース（認証）
    const authResource = rootResource.addResource('auth');
    
    // POST /auth/login - ログイン
    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', lambdaIntegration, {
      operationName: 'Login',
    });
    
    // POST /auth/logout - ログアウト
    const logoutResource = authResource.addResource('logout');
    logoutResource.addMethod('POST', lambdaIntegration, {
      operationName: 'Logout',
    });

    // ヘルスチェック用エンドポイント
    const healthResource = rootResource.addResource('health');
    healthResource.addMethod('GET', lambdaIntegration, {
      operationName: 'HealthCheck',
    });

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.apiUrl = api.url;
    this.vpcId = vpc.vpcId;
    this.databaseEndpoint = database.instanceEndpoint.hostname;
    this.databaseSecretArn = databaseSecret.secretArn;

    // 📤 CloudFormation出力の定義
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'ブログバックエンドAPIのベースURL',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL エンドポイント',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: databaseSecret.secretArn,
      description: 'データベース認証情報（Secrets Manager ARN）',
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: databaseSecurityGroup.securityGroupId,
      description: 'データベース用セキュリティグループID',
    });

    // 📚 便利な出力: 実際のエンドポイントURL
    new cdk.CfnOutput(this, 'PostsEndpoint', {
      value: `${api.url}posts`,
      description: 'ブログ記事エンドポイント',
    });

    new cdk.CfnOutput(this, 'AuthEndpoint', {
      value: `${api.url}auth`,
      description: '認証エンドポイント',
    });

    new cdk.CfnOutput(this, 'HealthEndpoint', {
      value: `${api.url}health`,
      description: 'ヘルスチェックエンドポイント',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ 複雑なオブジェクト設定: VPC、RDS、セキュリティグループ
    // ✅ 条件分岐: environment === 'prod' ? A : B
    // ✅ JSON操作: JSON.stringify()
    // ✅ 文字列配列結合: array.join(',')
    // ✅ undefined チェック: value || defaultValue
    // ✅ 複数リソース間の依存関係管理
    // ✅ ARN（Amazon Resource Name）の扱い

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ VPC: プライベートネットワーク、サブネット設計
    // ✅ RDS: リレーショナルデータベース、高可用性設定
    // ✅ Secrets Manager: 機密情報の安全な管理
    // ✅ セキュリティグループ: ファイアウォールルール
    // ✅ Lambda Layer: 共通ライブラリの効率的な管理
    // ✅ VPCエンドポイント: AWSサービスへのプライベート接続
    // ✅ CloudWatch Logs: ログの集中管理
    // ✅ IAM Policy: 詳細な権限制御
    // ✅ エンタープライズアーキテクチャ: セキュリティとスケーラビリティの両立
  }
}