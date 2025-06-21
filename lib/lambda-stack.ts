// TypeScript: AWS Lambda関連のライブラリをimport
import * as cdk from 'aws-cdk-lib';                      // CDKメインライブラリ
import * as lambda from 'aws-cdk-lib/aws-lambda';       // Lambda関数用
import * as events from 'aws-cdk-lib/aws-events';       // CloudWatch Events用
import * as targets from 'aws-cdk-lib/aws-events-targets'; // イベントターゲット用
import * as iam from 'aws-cdk-lib/aws-iam';             // IAM権限管理用
import { Construct } from 'constructs';                  // 基本コンストラクト

// TypeScript: Lambdaスタッククラスの定義
export class LambdaStack extends cdk.Stack {
  // コンストラクタ（クラスが作られる時に実行される初期化関数）
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props); // 親クラス（cdk.Stack）の初期化を実行

    // 基本的なLambda関数
    // TypeScript: new lambda.Function()でLambda関数を作成
    const basicFunction = new lambda.Function(this, 'BasicFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,    // 実行環境（Python 3.9）
      handler: 'index.handler',               // 実行する関数の場所（ファイル名.関数名）
      // TypeScript: 複数行文字列はバッククォートを使用
      code: lambda.Code.fromInline(`
import json

def handler(event, context):
    print('Hello from Lambda!')
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Hello from Lambda!',
            'event': event
        })
    }
      `), // fromInline()は文字列として直接コードを記述する方法
      timeout: cdk.Duration.seconds(30),     // 実行時間制限（30秒）
      // TypeScript: オブジェクト内でキー:値のペアを設定
      environment: {                         // 環境変数の設定
        ENVIRONMENT: 'development',          // 文字列:文字列
        LOG_LEVEL: 'INFO',
      },
    });

    // Node.js Lambda関数
    const nodeFunction = new lambda.Function(this, 'NodeFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    const response = {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello from Node.js Lambda!',
            timestamp: new Date().toISOString(),
            event: event
        })
    };
    
    return response;
};
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // 定期実行するLambda関数
    const scheduledFunction = new lambda.Function(this, 'ScheduledFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
from datetime import datetime

def handler(event, context):
    current_time = datetime.now().isoformat()
    print(f'Scheduled function executed at {current_time}')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Scheduled execution completed',
            'execution_time': current_time
        })
    }
      `),
    });

    // CloudWatch Eventsルール（定期実行）
    const scheduleRule = new events.Rule(this, 'ScheduleRule', {
      description: 'Lambda関数を5分ごとに実行',
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });

    // Lambda関数をターゲットに追加
    scheduleRule.addTarget(new targets.LambdaFunction(scheduledFunction));

    // Lambda関数にCloudWatch Logsの権限を付与
    const logPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'],
    });

    basicFunction.addToRolePolicy(logPolicy);
    nodeFunction.addToRolePolicy(logPolicy);
    scheduledFunction.addToRolePolicy(logPolicy);

    // 出力（CloudFormationの出力値）
    // TypeScript: 作成したリソースの情報を出力として定義
    new cdk.CfnOutput(this, 'BasicFunctionArn', {
      value: basicFunction.functionArn,      // Lambda関数のARN（Amazon Resource Name）
      description: '基本Lambda関数のARN',
    });

    new cdk.CfnOutput(this, 'NodeFunctionName', {
      value: nodeFunction.functionName,      // Lambda関数の名前
      description: 'Node.js Lambda関数名',
    });

    new cdk.CfnOutput(this, 'ScheduledFunctionName', {
      value: scheduledFunction.functionName, // 定期実行関数の名前
      description: '定期実行Lambda関数名',
    });
    
    // TypeScript学習ポイント（このファイル）:
    // - 複数行文字列: バッククォート`で囲む
    // - オブジェクトのプロパティ: { key: value, key2: value2 }
    // - メソッドチェーン: オブジェクト.メソッド()の連続呼び出し
    // - 型指定: 変数名: 型名（例: id: string）
    // - 条件付きプロパティ: props?（?マークで任意を表現）
  }
}