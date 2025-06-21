// TypeScript: API Gateway関連のライブラリをimport
import * as cdk from 'aws-cdk-lib';                    // CDKメインライブラリ
import * as apigateway from 'aws-cdk-lib/aws-apigateway'; // API Gateway関連
import * as lambda from 'aws-cdk-lib/aws-lambda';     // Lambda関数用
import * as iam from 'aws-cdk-lib/aws-iam';           // IAM権限管理用
import { Construct } from 'constructs';                // 基本コンストラクト

// TypeScript: API Gatewayスタッククラスの定義
export class ApiGatewayStack extends cdk.Stack {
  // コンストラクタ
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props); // 親クラスの初期化

    // Lambda関数（API用）
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import os
from datetime import datetime

def handler(event, context):
    # リクエスト情報を取得
    http_method = event.get('httpMethod', 'Unknown')
    path = event.get('path', 'Unknown')
    query_params = event.get('queryStringParameters') or {}
    headers = event.get('headers') or {}
    body = event.get('body')
    
    # レスポンスデータ
    response_data = {
        'message': 'Hello from API Gateway + Lambda!',
        'timestamp': datetime.now().isoformat(),
        'method': http_method,
        'path': path,
        'queryParameters': query_params,
        'requestId': context.aws_request_id,
    }
    
    # POSTリクエストの場合、ボディを含める
    if body and http_method == 'POST':
        try:
            parsed_body = json.loads(body)
            response_data['requestBody'] = parsed_body
        except json.JSONDecodeError:
            response_data['requestBody'] = body
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        'body': json.dumps(response_data, ensure_ascii=False)
    }
      `),
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: 'dev',
      },
    });

    // Hello World用のシンプルなLambda関数
    const helloFunction = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
    const name = event.queryStringParameters?.name || 'World';
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            message: \`Hello, \${name}!\`,
            timestamp: new Date().toISOString()
        })
    };
};
      `),
    });

    // REST API Gateway
    const api = new apigateway.RestApi(this, 'LearningApi', {
      restApiName: 'CDK Learning API',
      description: 'CDK学習用のREST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: {
        stageName: 'dev',
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // Lambda統合
    const apiIntegration = new apigateway.LambdaIntegration(apiFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const helloIntegration = new apigateway.LambdaIntegration(helloFunction);

    // API リソースとメソッド
    // /api リソース
    const apiResource = api.root.addResource('api');
    apiResource.addMethod('GET', apiIntegration);
    apiResource.addMethod('POST', apiIntegration);

    // /api/hello リソース
    const helloResource = apiResource.addResource('hello');
    helloResource.addMethod('GET', helloIntegration);

    // /api/users リソース（モックレスポンス）
    const usersResource = apiResource.addResource('users');
    
    // モック統合
    const mockIntegration = new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              users: [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' },
                { id: 3, name: 'Charlie', email: 'charlie@example.com' },
              ],
            }),
          },
        },
      ],
      requestTemplates: {
        'application/json': '{ "statusCode": 200 }',
      },
    });

    usersResource.addMethod('GET', mockIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
      ],
    });

    // API Key と Usage Plan
    const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
      apiKeyName: 'learning-api-key',
      description: 'CDK学習用APIキー',
    });

    const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
      name: 'LearningUsagePlan',
      description: 'CDK学習用の使用量プラン',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });

    usagePlan.addApiKey(apiKey);

    // 出力
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API GatewayのベースURL',
    });

    new cdk.CfnOutput(this, 'ApiEndpoints', {
      value: JSON.stringify({
        'GET /api': `${api.url}api`,
        'POST /api': `${api.url}api`,
        'GET /api/hello': `${api.url}api/hello?name=YourName`,
        'GET /api/users': `${api.url}api/users`,
      }),
      description: '利用可能なAPIエンドポイント',
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID',
    });
  }
}