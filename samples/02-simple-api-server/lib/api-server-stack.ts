// 📚 TypeScript学習ポイント: API関連のライブラリimport
// APIサーバー構築に必要なAWSサービスのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// Lambda関数（サーバーレス実行環境）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// API Gateway（HTTPエンドポイント作成）
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// DynamoDB（NoSQLデータベース）
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';

// 📚 TypeScript学習ポイント: 設定用インターフェース
// APIサーバーの設定を型安全に定義
interface ApiServerStackProps extends cdk.StackProps {
  // 環境名（dev, staging, prod等）
  environment?: string;
  // API名（任意）
  apiName?: string;
  // CORS（クロスオリジンリクエスト）を有効にするか
  enableCors?: boolean;
}

// 📚 TypeScript学習ポイント: メインクラス定義
export class ApiServerStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ
  // 他のスタックからアクセス可能な読み取り専用プロパティ
  public readonly apiUrl: string;
  public readonly apiId: string;
  public readonly tableName: string;

  constructor(scope: Construct, id: string, props: ApiServerStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値とOR演算子
    // undefined/nullの場合にデフォルト値を使用
    const environment = props.environment || 'dev';
    const apiName = props.apiName || 'simple-api';
    const enableCors = props.enableCors !== false; // デフォルトはtrue

    // 📚 TypeScript学習ポイント: 一意な名前生成
    // アカウントIDとリージョンを含めてグローバルで一意にする
    const tableName = `${apiName}-${environment}-${this.account}`;

    // 🗄️ DynamoDBテーブルの作成
    // 📚 AWS学習ポイント: NoSQLデータベース
    const itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      tableName: tableName,
      
      // 📚 AWS学習ポイント: パーティションキー
      // DynamoDBのプライマリキー（必須）
      partitionKey: {
        name: 'id',                    // キー名
        type: dynamodb.AttributeType.STRING  // データ型
      },
      
      // 📚 AWS学習ポイント: 課金モード
      // PAY_PER_REQUEST = 使った分だけ課金（小規模アプリに最適）
      // PROVISIONED = 事前にキャパシティを指定
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // 学習用設定: スタック削除時にテーブルも削除
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 🔧 Lambda関数の作成
    // 📚 AWS学習ポイント: サーバーレス実行環境
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      // 実行環境: Python 3.11
      runtime: lambda.Runtime.PYTHON_3_11,
      
      // ハンドラー関数: ファイル名.関数名
      handler: 'api_handler.lambda_handler',
      
      // 📚 TypeScript学習ポイント: 外部ファイル指定
      // lambda/フォルダ内のPythonコードを使用
      code: lambda.Code.fromAsset('./samples/02-simple-api-server/lambda'),
      
      // 実行時間制限（30秒）
      timeout: cdk.Duration.seconds(30),
      
      // メモリサイズ（128MB〜10GB）
      memorySize: 128,
      
      // 📚 TypeScript学習ポイント: 環境変数オブジェクト
      // Lambda関数内で使用できる環境変数を設定
      environment: {
        TABLE_NAME: itemsTable.tableName,  // DynamoDBテーブル名
        ENVIRONMENT: environment,          // 実行環境
      },
    });

    // 📚 AWS学習ポイント: IAM権限の付与
    // Lambda関数にDynamoDBへの読み書き権限を付与
    itemsTable.grantReadWriteData(apiHandler);

    // 🌐 API Gatewayの作成
    // 📚 AWS学習ポイント: REST API エンドポイント
    const api = new apigateway.RestApi(this, 'SimpleApi', {
      // API名
      restApiName: `${apiName}-${environment}`,
      
      // 説明文
      description: `Simple REST API for ${environment} environment`,
      
      // 📚 AWS学習ポイント: デプロイ設定
      deploy: true,  // 自動デプロイ
      deployOptions: {
        // ステージ名（URL内に含まれる）
        stageName: environment,
      },
      
      // 📚 TypeScript学習ポイント: 条件分岐演算子
      // enableCorsがtrueの場合のみCORS設定を適用
      defaultCorsPreflightOptions: enableCors ? {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,     // 全てのオリジンを許可
        allowMethods: apigateway.Cors.ALL_METHODS,     // 全てのHTTPメソッドを許可
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      } : undefined,  // undefinedの場合はCORS無効
    });

    // 📚 AWS学習ポイント: Lambda統合の作成
    // API GatewayとLambda関数を接続
    const lambdaIntegration = new apigateway.LambdaIntegration(apiHandler, {
      // レスポンス設定
      requestTemplates: { "application/json": '{ "statusCode": "200" }' },
    });

    // 📚 API設計学習ポイント: RESTful API エンドポイント設計

    // ルートパス "/" の作成
    const rootResource = api.root;
    
    // "/items" リソースの作成
    const itemsResource = rootResource.addResource('items');
    
    // 📚 HTTP学習ポイント: HTTPメソッドとエンドポイント
    
    // GET /items - 全アイテム取得
    itemsResource.addMethod('GET', lambdaIntegration, {
      // 📚 AWS学習ポイント: メソッド設定
      operationName: 'GetAllItems',
      requestParameters: {
        // クエリパラメータの設定
        'method.request.querystring.limit': false,  // 取得件数制限（任意）
      },
    });
    
    // POST /items - 新しいアイテム作成
    itemsResource.addMethod('POST', lambdaIntegration, {
      operationName: 'CreateItem',
    });
    
    // "/items/{id}" リソース（個別アイテム操作用）
    const itemResource = itemsResource.addResource('{id}');
    
    // GET /items/{id} - 特定アイテム取得
    itemResource.addMethod('GET', lambdaIntegration, {
      operationName: 'GetItem',
      requestParameters: {
        // パスパラメータの設定
        'method.request.path.id': true,  // idパラメータ（必須）
      },
    });
    
    // PUT /items/{id} - アイテム更新
    itemResource.addMethod('PUT', lambdaIntegration, {
      operationName: 'UpdateItem',
      requestParameters: {
        'method.request.path.id': true,
      },
    });
    
    // DELETE /items/{id} - アイテム削除
    itemResource.addMethod('DELETE', lambdaIntegration, {
      operationName: 'DeleteItem',
      requestParameters: {
        'method.request.path.id': true,
      },
    });

    // ヘルスチェック用エンドポイント
    const healthResource = rootResource.addResource('health');
    healthResource.addMethod('GET', lambdaIntegration, {
      operationName: 'HealthCheck',
    });

    // 📚 TypeScript学習ポイント: プロパティへの代入
    // 他のスタックやコードから参照できるように値を保存
    this.apiUrl = api.url;
    this.apiId = api.restApiId;
    this.tableName = itemsTable.tableName;

    // 📤 CloudFormation出力の定義
    // 📚 AWS学習ポイント: デプロイ完了後に表示される情報
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'REST APIのベースURL',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: api.restApiId,
      description: 'API Gateway REST API ID',
    });

    new cdk.CfnOutput(this, 'DynamoDbTableName', {
      value: itemsTable.tableName,
      description: 'DynamoDBテーブル名',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: apiHandler.functionName,
      description: 'Lambda関数名',
    });

    // 📚 便利な出力: 実際のエンドポイントURL
    new cdk.CfnOutput(this, 'ItemsEndpoint', {
      value: `${api.url}items`,
      description: 'アイテム操作エンドポイント',
    });

    new cdk.CfnOutput(this, 'HealthEndpoint', {
      value: `${api.url}health`,
      description: 'ヘルスチェックエンドポイント',
    });

    // 📚 TypeScript学習まとめ（このファイルで使用した概念）:
    // ✅ interface設定: 型安全な設定定義
    // ✅ デフォルト値: 値 || デフォルト値
    // ✅ 条件分岐: 条件 ? 真の値 : 偽の値
    // ✅ オブジェクト作成: new クラス名(引数)
    // ✅ メソッド呼び出し: オブジェクト.メソッド()
    // ✅ プロパティアクセス: オブジェクト.プロパティ
    // ✅ 型注釈: 変数名: 型名
    // ✅ テンプレートリテラル: `文字列${変数}`
    // ✅ 配列定義: ['値1', '値2']
    // ✅ ブール演算: !== false, === true

    // 📚 AWS学習まとめ（このファイルで学んだサービス）:
    // ✅ DynamoDB: NoSQLデータベース
    // ✅ Lambda: サーバーレス実行環境
    // ✅ API Gateway: REST APIエンドポイント
    // ✅ IAM: 権限管理
    // ✅ CloudFormation: インフラ定義と管理
  }
}