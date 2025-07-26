// 📚 TypeScript学習ポイント: 監視システム用import
// 包括的な監視・アラート・ダッシュボードシステムのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// CloudWatch（メトリクス・ログ・アラーム）
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// SNS（通知サービス）
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// Lambda（カスタムメトリクス・ヘルスチェック）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// Events（定期実行・イベント駆動）
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';
// CloudWatch Logs（ログ管理）
import * as logs from 'aws-cdk-lib/aws-logs';
// API Gateway（メトリクス監視対象）
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// DynamoDB（メトリクス保存）
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// SQS（非同期処理）
import * as sqs from 'aws-cdk-lib/aws-sqs';

// 📚 TypeScript学習ポイント: 監視システム設定インターフェース  
// 包括的な監視システムの詳細設定を型安全に定義
interface MonitoringStackProps extends cdk.StackProps {
  // プロジェクト名
  projectName?: string;
  // 環境名（dev, staging, prod等）
  environment?: string;
  // 通知メールアドレス（配列）
  notificationEmails?: string[];
  // Slack Webhook URL
  slackWebhookUrl?: string;
  // 監視対象リソースのARN配列
  monitoredResourceArns?: string[];
  // アラーム閾値設定
  alarmThresholds?: AlarmThresholds;
  // カスタムメトリクス有効化
  enableCustomMetrics?: boolean;
  // 詳細監視有効化
  enableDetailedMonitoring?: boolean;
  // ログ分析有効化
  enableLogAnalysis?: boolean;
}

// 📚 TypeScript学習ポイント: アラーム閾値設定型
interface AlarmThresholds {
  // エラー率（%）
  errorRatePercent?: number;
  // レスポンス時間（ms）
  responseTimeMs?: number;
  // CPU使用率（%）
  cpuUtilizationPercent?: number;
  // メモリ使用率（%）
  memoryUtilizationPercent?: number;
  // ディスク使用率（%）
  diskUtilizationPercent?: number;
  // 接続数
  connectionCount?: number;
}

// 📚 TypeScript学習ポイント: 監視ダッシュボードメインクラス
export class MonitoringStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly dashboardUrl: string;
  public readonly alarmTopicArn: string;
  public readonly healthCheckUrl: string;
  public readonly metricsTableName: string;

  constructor(scope: Construct, id: string, props: MonitoringStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の設定
    const projectName = props.projectName || 'monitoring-system';
    const environment = props.environment || 'dev';
    const notificationEmails = props.notificationEmails || [];
    const enableCustomMetrics = props.enableCustomMetrics !== false; // デフォルトtrue
    const enableDetailedMonitoring = props.enableDetailedMonitoring || (environment === 'prod');
    const enableLogAnalysis = props.enableLogAnalysis || (environment === 'prod');
    
    // 📚 TypeScript学習ポイント: オブジェクトのデフォルト値とマージ
    const defaultThresholds: AlarmThresholds = {
      errorRatePercent: 5,
      responseTimeMs: 1000,
      cpuUtilizationPercent: 80,
      memoryUtilizationPercent: 85,
      diskUtilizationPercent: 90,
      connectionCount: 100,
    };
    const alarmThresholds = { ...defaultThresholds, ...props.alarmThresholds };

    // 📊 カスタムメトリクス保存用DynamoDBテーブル
    // 📚 AWS学習ポイント: メトリクス データのタイムシリーズ保存
    const metricsTable = new dynamodb.Table(this, 'MetricsTable', {
      tableName: `${projectName}-metrics-${environment}`,
      
      // パーティションキー：メトリクス名
      partitionKey: {
        name: 'metricName',
        type: dynamodb.AttributeType.STRING,
      },
      
      // ソートキー：タイムスタンプ（時系列データ）
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      
      // 📚 AWS学習ポイント: TTL（Time To Live）設定
      timeToLiveAttribute: 'ttl', // 古いメトリクスデータを自動削除
      
      // オンデマンド課金
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // 📚 AWS学習ポイント: ストリーム設定（リアルタイム処理用）
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 📬 SNS トピック（アラーム通知）
    const alarmTopic = new sns.Topic(this, 'AlarmNotifications', {
      topicName: `${projectName}-alarms-${environment}`,
      displayName: 'System Monitoring Alarms',
    });

    // 📧 メール通知の設定
    notificationEmails.forEach((email, index) => {
      alarmTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(email, {
          filterPolicy: {
            // 📚 AWS学習ポイント: フィルターポリシー（通知の条件分岐）
            severity: sns.SubscriptionFilter.stringFilter({
              allowlist: ['HIGH', 'CRITICAL'],
            }),
          },
        })
      );
    });

    // 📱 Slack通知用Lambda（WebhookでSlackに投稿）
    let slackNotificationFunction: lambda.Function | undefined;
    if (props.slackWebhookUrl) {
      slackNotificationFunction = new lambda.Function(this, 'SlackNotificationFunction', {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'slack_notifier.lambda_handler',
        code: lambda.Code.fromInline(`
import json
import urllib3
import os

def lambda_handler(event, context):
    """
    📚 実装内容: SNSメッセージをSlackに転送
    """
    http = urllib3.PoolManager()
    
    # SNSメッセージをパース
    for record in event['Records']:
        sns_message = json.loads(record['Sns']['Message'])
        
        # CloudWatchアラーム情報を抽出
        alarm_name = sns_message.get('AlarmName', 'Unknown')
        alarm_description = sns_message.get('AlarmDescription', '')
        new_state = sns_message.get('NewStateValue', 'UNKNOWN')
        reason = sns_message.get('NewStateReason', '')
        
        # 📚 Slack通知の色設定
        color_map = {
            'ALARM': '#FF0000',    # 赤
            'OK': '#00FF00',       # 緑  
            'INSUFFICIENT_DATA': '#FFFF00'  # 黄
        }
        
        # Slackメッセージ構築
        slack_message = {
            'text': f'🚨 CloudWatch Alarm: {alarm_name}',
            'attachments': [
                {
                    'color': color_map.get(new_state, '#808080'),
                    'fields': [
                        {
                            'title': 'Alarm Name',
                            'value': alarm_name,
                            'short': True
                        },
                        {
                            'title': 'State',
                            'value': new_state,
                            'short': True
                        },
                        {
                            'title': 'Description',
                            'value': alarm_description,
                            'short': False
                        },
                        {
                            'title': 'Reason',
                            'value': reason,
                            'short': False
                        }
                    ]
                }
            ]
        }
        
        # Slack Webhook に送信
        encoded_msg = json.dumps(slack_message).encode('utf-8')
        response = http.request('POST', os.environ['SLACK_WEBHOOK_URL'], body=encoded_msg)
        
        print(f'Slack notification sent: {response.status}')
    
    return {'statusCode': 200, 'body': 'Notifications sent'}
        `),
        environment: {
          SLACK_WEBHOOK_URL: props.slackWebhookUrl,
        },
        timeout: cdk.Duration.seconds(30),
      });

      // SNSトピックからLambdaを呼び出し
      alarmTopic.addSubscription(
        new snsSubscriptions.LambdaSubscription(slackNotificationFunction)
      );
    }

    // ⚡ ヘルスチェック用Lambda関数
    // 📚 AWS学習ポイント: システムヘルスチェックの実装
    const healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'health_check.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import time
import requests
from datetime import datetime, timedelta

cloudwatch = boto3.client('cloudwatch')
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    📚 実装内容: システム全体のヘルスチェック実行
    """
    health_results = []
    overall_status = 'HEALTHY'
    
    try:
        # 📚 チェック1: API Gateway エンドポイントの応答確認
        api_endpoints = event.get('apiEndpoints', [])
        for endpoint in api_endpoints:
            try:
                response = requests.get(endpoint, timeout=10)
                if response.status_code == 200:
                    health_results.append({
                        'service': 'API',
                        'endpoint': endpoint,
                        'status': 'HEALTHY',
                        'response_time': response.elapsed.total_seconds()
                    })
                else:
                    health_results.append({
                        'service': 'API',
                        'endpoint': endpoint,
                        'status': 'UNHEALTHY',
                        'error': f'HTTP {response.status_code}'
                    })
                    overall_status = 'UNHEALTHY'
            except Exception as e:
                health_results.append({
                    'service': 'API',
                    'endpoint': endpoint,
                    'status': 'UNHEALTHY',
                    'error': str(e)
                })
                overall_status = 'UNHEALTHY'
        
        # 📚 チェック2: DynamoDB テーブルの読み書きテスト
        table_name = event.get('metricsTableName')
        if table_name:
            try:
                table = dynamodb.Table(table_name)
                test_item = {
                    'metricName': 'health_check_test',
                    'timestamp': datetime.utcnow().isoformat(),
                    'value': 1,
                    'ttl': int(time.time()) + 300  # 5分後に削除
                }
                table.put_item(Item=test_item)
                
                # 読み取りテスト
                response = table.get_item(Key={
                    'metricName': 'health_check_test',
                    'timestamp': test_item['timestamp']
                })
                
                if 'Item' in response:
                    health_results.append({
                        'service': 'DynamoDB',
                        'table': table_name,
                        'status': 'HEALTHY'
                    })
                else:
                    health_results.append({
                        'service': 'DynamoDB',
                        'table': table_name,
                        'status': 'UNHEALTHY',
                        'error': 'Read test failed'
                    })
                    overall_status = 'UNHEALTHY'
                    
            except Exception as e:
                health_results.append({
                    'service': 'DynamoDB',
                    'table': table_name,
                    'status': 'UNHEALTHY',
                    'error': str(e)
                })
                overall_status = 'UNHEALTHY'
        
        # 📚 カスタムメトリクスをCloudWatchに送信
        cloudwatch.put_metric_data(
            Namespace=f'{event.get("projectName", "monitoring")}/HealthCheck',
            MetricData=[
                {
                    'MetricName': 'OverallHealth',
                    'Value': 1 if overall_status == 'HEALTHY' else 0,
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow()
                },
                {
                    'MetricName': 'HealthyServices',
                    'Value': len([r for r in health_results if r['status'] == 'HEALTHY']),
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow()
                }
            ]
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'overall_status': overall_status,
                'timestamp': datetime.utcnow().isoformat(),
                'health_results': health_results
            })
        }
        
    except Exception as e:
        print(f'Health check error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'overall_status': 'ERROR',
                'error': str(e)
            })
        }
      `),
      environment: {
        METRICS_TABLE_NAME: metricsTable.tableName,
        PROJECT_NAME: projectName,
        ENVIRONMENT: environment,
      },
      timeout: cdk.Duration.minutes(2),
    });

    // 📚 AWS学習ポイント: Lambda の CloudWatch・DynamoDB アクセス権限
    metricsTable.grantReadWriteData(healthCheckFunction);
    healthCheckFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics',
      ],
      resources: ['*'],
    }));

    // ⚡ カスタムメトリクス収集用Lambda関数
    const metricsCollectorFunction = new lambda.Function(this, 'MetricsCollectorFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'metrics_collector.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import time
import psutil
import requests
from datetime import datetime

cloudwatch = boto3.client('cloudwatch')
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    📚 実装内容: カスタムメトリクスの収集と送信
    """
    metrics_data = []
    
    try:
        # 📚 システムメトリクス収集
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # 📚 ネットワークメトリクス
        network = psutil.net_io_counters()
        
        # 📚 カスタムビジネスメトリクス（例：アクティブユーザー数）
        active_users = get_active_users_count()
        
        # 📚 メトリクスデータ配列を構築
        current_time = datetime.utcnow()
        
        metrics_data.extend([
            {
                'MetricName': 'CPUUtilization',
                'Value': cpu_percent,
                'Unit': 'Percent',
                'Timestamp': current_time
            },
            {
                'MetricName': 'MemoryUtilization',
                'Value': memory.percent,
                'Unit': 'Percent',
                'Timestamp': current_time
            },
            {
                'MetricName': 'DiskUtilization',
                'Value': (disk.used / disk.total) * 100,
                'Unit': 'Percent',
                'Timestamp': current_time
            },
            {
                'MetricName': 'NetworkBytesIn',
                'Value': network.bytes_recv,
                'Unit': 'Bytes',
                'Timestamp': current_time
            },
            {
                'MetricName': 'NetworkBytesOut',
                'Value': network.bytes_sent,
                'Unit': 'Bytes',
                'Timestamp': current_time
            },
            {
                'MetricName': 'ActiveUsers',
                'Value': active_users,
                'Unit': 'Count',
                'Timestamp': current_time
            }
        ])
        
        # 📚 CloudWatchへメトリクス送信
        namespace = f'{event.get("projectName", "monitoring")}/CustomMetrics'
        cloudwatch.put_metric_data(
            Namespace=namespace,
            MetricData=metrics_data
        )
        
        # 📚 DynamoDBへの詳細メトリクス保存
        table_name = event.get('metricsTableName')
        if table_name:
            table = dynamodb.Table(table_name)
            
            for metric in metrics_data:
                table.put_item(Item={
                    'metricName': metric['MetricName'],
                    'timestamp': metric['Timestamp'].isoformat(),
                    'value': metric['Value'],
                    'unit': metric['Unit'],
                    'ttl': int(time.time()) + (30 * 24 * 60 * 60),  # 30日後に削除
                    'environment': event.get('environment', 'dev')
                })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Metrics collected successfully',
                'metrics_count': len(metrics_data)
            })
        }
        
    except Exception as e:
        print(f'Metrics collection error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_active_users_count():
    """
    📚 ビジネスメトリクス例: アクティブユーザー数を取得
    実際の実装では、データベースクエリやAPIコールを行う
    """
    # デモ用のランダム値
    import random
    return random.randint(10, 1000)
      `),
      environment: {
        METRICS_TABLE_NAME: metricsTable.tableName,
        PROJECT_NAME: projectName,
        ENVIRONMENT: environment,
      },
      timeout: cdk.Duration.minutes(1),
    });

    // 権限設定
    metricsTable.grantReadWriteData(metricsCollectorFunction);
    metricsCollectorFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // 📅 EventBridge ルール（定期実行）
    // 📚 AWS学習ポイント: cron式による定期実行設定

    // ヘルスチェック：5分間隔
    const healthCheckRule = new events.Rule(this, 'HealthCheckRule', {
      ruleName: `${projectName}-health-check-${environment}`,
      description: 'Regular health check execution',
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });
    
    healthCheckRule.addTarget(new targets.LambdaFunction(healthCheckFunction, {
      event: events.RuleTargetInput.fromObject({
        projectName: projectName,
        environment: environment,
        metricsTableName: metricsTable.tableName,
        apiEndpoints: [], // 実際の環境では監視対象のAPI URLを設定
      }),
    }));

    // カスタムメトリクス収集：1分間隔
    const metricsCollectionRule = new events.Rule(this, 'MetricsCollectionRule', {
      ruleName: `${projectName}-metrics-collection-${environment}`,
      description: 'Regular custom metrics collection',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    
    metricsCollectionRule.addTarget(new targets.LambdaFunction(metricsCollectorFunction, {
      event: events.RuleTargetInput.fromObject({
        projectName: projectName,
        environment: environment,
        metricsTableName: metricsTable.tableName,
      }),
    }));

    // 🌐 監視用API Gateway
    // 📚 AWS学習ポイント: ヘルスチェック・メトリクス取得API
    const monitoringApi = new apigateway.RestApi(this, 'MonitoringApi', {
      restApiName: `${projectName}-monitoring-api-${environment}`,
      description: 'Monitoring and Health Check API',
      deployOptions: {
        stageName: environment,
      },
    });

    // Lambda統合
    const healthCheckIntegration = new apigateway.LambdaIntegration(healthCheckFunction);

    // /health エンドポイント
    const healthResource = monitoringApi.root.addResource('health');
    healthResource.addMethod('GET', healthCheckIntegration);

    // 📊 CloudWatch ダッシュボード
    // 📚 AWS学習ポイント: 統合監視ダッシュボードの作成
    const dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `${projectName}-dashboard-${environment}`,
    });

    // 📚 AWS学習ポイント: ダッシュボードウィジェット追加
    
    // システムメトリクス ウィジェット
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'System Metrics',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: `${projectName}/CustomMetrics`,
            metricName: 'CPUUtilization',
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: `${projectName}/CustomMetrics`,
            metricName: 'MemoryUtilization',
            statistic: 'Average',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: `${projectName}/CustomMetrics`,
            metricName: 'DiskUtilization',
            statistic: 'Average',
          }),
        ],
      })
    );

    // ヘルスチェック ウィジェット
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Overall Health Status',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.Metric({
            namespace: `${projectName}/HealthCheck`,
            metricName: 'OverallHealth',
            statistic: 'Average',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Healthy Services Count',
        width: 6,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: `${projectName}/HealthCheck`,
            metricName: 'HealthyServices',
            statistic: 'Average',
          }),
        ],
      })
    );

    // 📚 AWS学習ポイント: CloudWatch アラーム設定
    
    // CPU使用率アラーム
    const cpuAlarm = new cloudwatch.Alarm(this, 'HighCPUAlarm', {
      alarmName: `${projectName}-high-cpu-${environment}`,
      alarmDescription: 'High CPU utilization detected',
      metric: new cloudwatch.Metric({
        namespace: `${projectName}/CustomMetrics`,
        metricName: 'CPUUtilization',
        statistic: 'Average',
      }),
      threshold: alarmThresholds.cpuUtilizationPercent!,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    // メモリ使用率アラーム
    const memoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      alarmName: `${projectName}-high-memory-${environment}`,
      alarmDescription: 'High memory utilization detected',
      metric: new cloudwatch.Metric({
        namespace: `${projectName}/CustomMetrics`,
        metricName: 'MemoryUtilization',
        statistic: 'Average',
      }),
      threshold: alarmThresholds.memoryUtilizationPercent!,
      evaluationPeriods: 2,
    });

    // ヘルスチェック失敗アラーム
    const healthAlarm = new cloudwatch.Alarm(this, 'HealthCheckFailureAlarm', {
      alarmName: `${projectName}-health-check-failure-${environment}`,
      alarmDescription: 'Health check is failing',
      metric: new cloudwatch.Metric({
        namespace: `${projectName}/HealthCheck`,
        metricName: 'OverallHealth',
        statistic: 'Average',
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 1,
    });

    // 📚 AWS学習ポイント: アラームアクション設定
    const alarms = [cpuAlarm, memoryAlarm, healthAlarm];
    alarms.forEach(alarm => {
      alarm.addAlarmAction(new cloudwatch.SnsAction(alarmTopic));
      alarm.addOkAction(new cloudwatch.SnsAction(alarmTopic));
    });

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.dashboardUrl = `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`;
    this.alarmTopicArn = alarmTopic.topicArn;
    this.healthCheckUrl = `${monitoringApi.url}health`;
    this.metricsTableName = metricsTable.tableName;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: this.dashboardUrl,
      description: 'CloudWatch ダッシュボードURL',
    });

    new cdk.CfnOutput(this, 'HealthCheckUrl', {
      value: this.healthCheckUrl,
      description: 'ヘルスチェックAPI URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'アラーム通知SNSトピック ARN',
    });

    new cdk.CfnOutput(this, 'MetricsTableName', {
      value: metricsTable.tableName,
      description: 'メトリクスデータ保存テーブル名',
    });

    // 📚 便利な出力: 各種監視設定
    new cdk.CfnOutput(this, 'CPUAlarmName', {
      value: cpuAlarm.alarmName,
      description: 'CPU使用率アラーム名',
    });

    new cdk.CfnOutput(this, 'MemoryAlarmName', {
      value: memoryAlarm.alarmName,
      description: 'メモリ使用率アラーム名',
    });

    new cdk.CfnOutput(this, 'HealthAlarmName', {
      value: healthAlarm.alarmName,
      description: 'ヘルスチェック失敗アラーム名',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ スプレッド演算子: { ...defaultObject, ...customObject }
    // ✅ 配列操作: forEach(), filter(), map()
    // ✅ 条件分岐: !== false, === 'prod'
    // ✅ オブジェクト分割代入: const { property } = object
    // ✅ 動的プロパティアクセス: object[key]
    // ✅ 非同期処理: async/await パターン
    // ✅ エラーハンドリング: try/catch文

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ CloudWatch: メトリクス、ダッシュボード、アラーム
    // ✅ SNS: フィルターポリシー、複数サブスクリプション
    // ✅ EventBridge: cron式、定期実行
    // ✅ DynamoDB TTL: 自動データ削除
    // ✅ Lambda 権限: IAMポリシーステートメント
    // ✅ カスタムメトリクス: ビジネス KPI の監視
    // ✅ 統合監視: システム全体の可観測性実現
    // ✅ アラート設計: 閾値設定とエスカレーション
  }
}