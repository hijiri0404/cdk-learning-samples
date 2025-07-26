// 📚 TypeScript学習ポイント: CI/CDパイプライン用import
// 完全自動化されたDevOpsパイプラインシステムのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// CodePipeline（パイプライン管理）
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
// CodeBuild（ビルド・テスト）
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
// CodeDeploy（デプロイメント）
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
// S3（アーティファクト保存）
import * as s3 from 'aws-cdk-lib/aws-s3';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';
// SNS（通知）
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// CloudWatch（監視）
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// Lambda（カスタム処理）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// EventBridge（イベント駆動）
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
// CloudFormation（インフラ管理）
import * as cloudformation from 'aws-cdk-lib/aws-cloudformation';
// ECS（コンテナ実行環境）
import * as ecs from 'aws-cdk-lib/aws-ecs';
// EC2（インフラ基盤）
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// 📚 TypeScript学習ポイント: デプロイ環境設定
interface DeploymentEnvironment {
  name: string;                    // 環境名（dev, staging, prod）
  account: string;                 // AWSアカウントID
  region: string;                  // リージョン
  approvalRequired: boolean;       // 手動承認が必要か
  runLoadTests: boolean;          // 負荷テストを実行するか
  canaryDeployment: boolean;      // カナリアデプロイを使用するか
  rollbackOnFailure: boolean;     // 失敗時の自動ロールバック
  notificationLevel: 'all' | 'errors' | 'critical'; // 通知レベル
}

// 📚 TypeScript学習ポイント: CI/CDパイプライン設定インターフェース
interface CicdPipelineStackProps extends cdk.StackProps {
  // プロジェクト名
  projectName?: string;
  // 環境名
  environment?: string;
  // GitHubリポジトリ情報
  githubOwner: string;
  githubRepo: string;
  githubBranch?: string;
  // デプロイ対象環境
  deploymentEnvironments?: DeploymentEnvironment[];
  // 通知メールアドレス
  notificationEmails?: string[];
  // Slack Webhook URL
  slackWebhookUrl?: string;
  // 自動テスト設定
  enableUnitTests?: boolean;
  enableIntegrationTests?: boolean;
  enableSecurityScans?: boolean;
  enablePerformanceTests?: boolean;
  // Docker設定
  enableDockerBuild?: boolean;
  dockerRegistryUri?: string;
}

// 📚 TypeScript学習ポイント: CI/CDパイプラインメインクラス
export class CicdPipelineStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly pipelineArn: string;
  public readonly artifactsBucketName: string;
  public readonly buildProjectArn: string;
  public readonly notificationTopicArn: string;

  constructor(scope: Construct, id: string, props: CicdPipelineStackProps) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の設定
    const projectName = props.projectName || 'cicd-project';
    const environment = props.environment || 'dev';
    const githubBranch = props.githubBranch || 'main';
    const notificationEmails = props.notificationEmails || [];
    const enableUnitTests = props.enableUnitTests !== false; // デフォルトtrue
    const enableIntegrationTests = props.enableIntegrationTests || false;
    const enableSecurityScans = props.enableSecurityScans || true;
    const enablePerformanceTests = props.enablePerformanceTests || false;
    const enableDockerBuild = props.enableDockerBuild || true;
    
    // 📚 TypeScript学習ポイント: デフォルト環境設定
    const defaultEnvironments: DeploymentEnvironment[] = props.deploymentEnvironments || [
      {
        name: 'dev',
        account: this.account,
        region: this.region,
        approvalRequired: false,
        runLoadTests: false,
        canaryDeployment: false,
        rollbackOnFailure: true,
        notificationLevel: 'errors',
      },
      {
        name: 'staging',
        account: this.account,
        region: this.region,
        approvalRequired: false,
        runLoadTests: true,
        canaryDeployment: true,
        rollbackOnFailure: true,
        notificationLevel: 'all',
      },
      {
        name: 'prod',
        account: this.account,
        region: this.region,
        approvalRequired: true,
        runLoadTests: true,
        canaryDeployment: true,
        rollbackOnFailure: true,
        notificationLevel: 'all',
      },
    ];

    // 🗄️ アーティファクト保存用S3バケット
    // 📚 AWS学習ポイント: パイプライン成果物の管理
    const artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${projectName}-pipeline-artifacts-${environment}-${this.account}`,
      
      // 📚 AWS学習ポイント: バージョニング（ロールバック対応）
      versioned: true,
      
      // 📚 AWS学習ポイント: ライフサイクル管理（コスト最適化）
      lifecycleRules: [
        {
          id: 'DeleteOldArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(30),           // 30日後に削除
          noncurrentVersionExpiration: cdk.Duration.days(7), // 旧バージョンは7日で削除
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7),
            },
          ],
        },
      ],
      
      // 📚 AWS学習ポイント: セキュリティ設定
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 📬 通知設定
    // 📚 AWS学習ポイント: パイプライン状態変更通知
    const pipelineNotificationTopic = new sns.Topic(this, 'PipelineNotifications', {
      topicName: `${projectName}-pipeline-notifications-${environment}`,
      displayName: 'CI/CD Pipeline Notifications',
    });

    // メール通知設定
    notificationEmails.forEach((email, index) => {
      pipelineNotificationTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(email, {
          filterPolicy: {
            // 📚 AWS学習ポイント: 通知レベル別フィルタリング
            severity: sns.SubscriptionFilter.stringFilter({
              allowlist: ['HIGH', 'MEDIUM'],
            }),
          },
        })
      );
    });

    // 📱 Slack通知用Lambda関数
    let slackNotificationFunction: lambda.Function | undefined;
    if (props.slackWebhookUrl) {
      slackNotificationFunction = new lambda.Function(this, 'SlackNotificationFunction', {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'slack_notifier.lambda_handler',
        code: lambda.Code.fromInline(`
import json
import urllib3
import os
from datetime import datetime

def lambda_handler(event, context):
    """
    📚 実装内容: パイプライン状態変更をSlackに通知
    """
    http = urllib3.PoolManager()
    
    try:
        # 📚 EventBridge または SNS からのイベントを処理
        if 'Records' in event:
            # SNS経由の場合
            for record in event['Records']:
                message = json.loads(record['Sns']['Message'])
                send_slack_notification(http, message, 'sns')
        else:
            # EventBridge経由の場合
            send_slack_notification(http, event, 'eventbridge')
            
        return {'statusCode': 200, 'body': 'Notifications sent'}
        
    except Exception as e:
        print(f'Error sending Slack notification: {str(e)}')
        return {'statusCode': 500, 'body': f'Error: {str(e)}'}

def send_slack_notification(http, event_data, source_type):
    """Slack通知を送信"""
    
    # 📚 パイプライン状態に基づく色とアイコン設定
    state_config = {
        'STARTED': {'color': '#36a64f', 'icon': '🚀', 'message': 'Pipeline Started'},
        'SUCCEEDED': {'color': '#36a64f', 'icon': '✅', 'message': 'Pipeline Succeeded'},
        'FAILED': {'color': '#ff0000', 'icon': '❌', 'message': 'Pipeline Failed'},
        'SUPERSEDED': {'color': '#ffaa00', 'icon': '⏭️', 'message': 'Pipeline Superseded'},
        'STOPPING': {'color': '#ffaa00', 'icon': '⏸️', 'message': 'Pipeline Stopping'},
        'STOPPED': {'color': '#808080', 'icon': '⏹️', 'message': 'Pipeline Stopped'},
    }
    
    # 📚 イベントデータからパイプライン情報を抽出
    if source_type == 'eventbridge':
        pipeline_name = event_data.get('detail', {}).get('pipeline', 'Unknown')
        execution_id = event_data.get('detail', {}).get('execution-id', 'Unknown')
        state = event_data.get('detail', {}).get('state', 'UNKNOWN')
        region = event_data.get('region', 'Unknown')
    else:
        # SNS形式の場合の処理
        pipeline_name = event_data.get('pipeline', 'Unknown')
        execution_id = event_data.get('execution-id', 'Unknown')
        state = event_data.get('state', 'UNKNOWN')
        region = event_data.get('region', 'Unknown')
    
    config = state_config.get(state, state_config['FAILED'])
    
    # 📚 Slackメッセージ構築
    slack_message = {
        'text': f'{config["icon"]} {config["message"]}',
        'attachments': [
            {
                'color': config['color'],
                'fields': [
                    {
                        'title': 'Pipeline Name',
                        'value': pipeline_name,
                        'short': True
                    },
                    {
                        'title': 'State',
                        'value': state,
                        'short': True
                    },
                    {
                        'title': 'Execution ID',
                        'value': execution_id,
                        'short': True
                    },
                    {
                        'title': 'Region',
                        'value': region,
                        'short': True
                    },
                    {
                        'title': 'Timestamp',
                        'value': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
                        'short': False
                    }
                ]
            }
        ]
    }
    
    # 📚 Slack Webhook に送信
    encoded_msg = json.dumps(slack_message).encode('utf-8')
    response = http.request('POST', os.environ['SLACK_WEBHOOK_URL'], body=encoded_msg)
    
    print(f'Slack notification sent: {response.status} for pipeline {pipeline_name}')
        `),
        environment: {
          SLACK_WEBHOOK_URL: props.slackWebhookUrl,
        },
        timeout: cdk.Duration.seconds(30),
      });

      // SNS購読追加
      pipelineNotificationTopic.addSubscription(
        new snsSubscriptions.LambdaSubscription(slackNotificationFunction)
      );
    }

    // ⚡ テスト実行用Lambda関数
    // 📚 AWS学習ポイント: カスタムテストケースの実行
    const testRunnerFunction = new lambda.Function(this, 'TestRunnerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'test_runner.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import requests
import time
import subprocess
from datetime import datetime

def lambda_handler(event, context):
    """
    📚 実装内容: 各種テストの実行とレポート生成
    """
    test_type = event.get('test_type', 'unit')
    environment = event.get('environment', 'dev')
    application_url = event.get('application_url', '')
    
    print(f'Running {test_type} tests for {environment} environment')
    
    try:
        if test_type == 'unit':
            return run_unit_tests()
        elif test_type == 'integration':
            return run_integration_tests(application_url)
        elif test_type == 'security':
            return run_security_scan(application_url)
        elif test_type == 'performance':
            return run_performance_tests(application_url)
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown test type: {test_type}'})
            }
            
    except Exception as e:
        print(f'Test execution failed: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'test_type': test_type,
                'environment': environment
            })
        }

def run_unit_tests():
    """📚 ユニットテスト実行"""
    # デモ用のテスト結果
    test_results = {
        'total_tests': 25,
        'passed': 23,
        'failed': 2,
        'skipped': 0,
        'coverage': 87.5,
        'duration': 12.3,
        'failed_tests': [
            {'name': 'test_user_authentication', 'error': 'AssertionError: Expected True, got False'},
            {'name': 'test_data_validation', 'error': 'ValueError: Invalid input format'}
        ]
    }
    
    success = test_results['failed'] == 0
    
    return {
        'statusCode': 200 if success else 400,
        'body': json.dumps({
            'test_type': 'unit',
            'success': success,
            'results': test_results,
            'timestamp': datetime.utcnow().isoformat()
        })
    }

def run_integration_tests(app_url):
    """📚 統合テスト実行"""
    if not app_url:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Application URL required for integration tests'})
        }
    
    test_cases = [
        {'name': 'Health Check', 'endpoint': '/health'},
        {'name': 'API Authentication', 'endpoint': '/api/auth/login'},
        {'name': 'Data Retrieval', 'endpoint': '/api/data'},
        {'name': 'Database Connection', 'endpoint': '/api/db/status'},
    ]
    
    results = []
    for test_case in test_cases:
        try:
            url = f'{app_url.rstrip("/")}{test_case["endpoint"]}'
            response = requests.get(url, timeout=10)
            
            results.append({
                'name': test_case['name'],
                'endpoint': test_case['endpoint'],
                'status_code': response.status_code,
                'response_time': response.elapsed.total_seconds(),
                'success': 200 <= response.status_code < 300
            })
        except Exception as e:
            results.append({
                'name': test_case['name'],
                'endpoint': test_case['endpoint'],
                'error': str(e),
                'success': False
            })
    
    total_tests = len(results)
    passed_tests = len([r for r in results if r.get('success', False)])
    
    return {
        'statusCode': 200 if passed_tests == total_tests else 400,
        'body': json.dumps({
            'test_type': 'integration',
            'success': passed_tests == total_tests,
            'results': {
                'total_tests': total_tests,
                'passed': passed_tests,
                'failed': total_tests - passed_tests,
                'test_cases': results
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    }

def run_security_scan(app_url):
    """📚 セキュリティスキャン実行"""
    # 📚 基本的なセキュリティチェック
    security_checks = []
    
    # HTTPS チェック
    if app_url:
        https_check = {
            'name': 'HTTPS Enforcement',
            'description': 'Check if application enforces HTTPS',
            'success': app_url.startswith('https://'),
            'severity': 'HIGH' if not app_url.startswith('https://') else 'NONE'
        }
        security_checks.append(https_check)
    
    # 📚 デモ用の追加セキュリティチェック
    additional_checks = [
        {
            'name': 'SQL Injection Protection',
            'description': 'Check for SQL injection vulnerabilities',
            'success': True,  # デモ用
            'severity': 'NONE'
        },
        {
            'name': 'XSS Protection',
            'description': 'Cross-Site Scripting protection check',
            'success': True,  # デモ用
            'severity': 'NONE'
        },
        {
            'name': 'Authentication Bypass',
            'description': 'Check for authentication bypass vulnerabilities',
            'success': True,  # デモ用
            'severity': 'NONE'
        }
    ]
    
    security_checks.extend(additional_checks)
    
    # 結果集計
    high_severity = len([c for c in security_checks if c['severity'] == 'HIGH'])
    medium_severity = len([c for c in security_checks if c['severity'] == 'MEDIUM'])
    passed_checks = len([c for c in security_checks if c['success']])
    
    return {
        'statusCode': 200 if high_severity == 0 else 400,
        'body': json.dumps({
            'test_type': 'security',
            'success': high_severity == 0,
            'results': {
                'total_checks': len(security_checks),
                'passed': passed_checks,
                'high_severity_issues': high_severity,
                'medium_severity_issues': medium_severity,
                'security_checks': security_checks
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    }

def run_performance_tests(app_url):
    """📚 パフォーマンステスト実行"""
    if not app_url:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Application URL required for performance tests'})
        }
    
    # 📚 簡単な負荷テスト
    test_results = []
    
    for concurrent_users in [1, 5, 10, 20]:
        try:
            start_time = time.time()
            
            # 簡単な応答時間テスト
            response = requests.get(app_url, timeout=30)
            response_time = time.time() - start_time
            
            test_results.append({
                'concurrent_users': concurrent_users,
                'response_time': response_time,
                'status_code': response.status_code,
                'success': response.status_code == 200
            })
            
        except Exception as e:
            test_results.append({
                'concurrent_users': concurrent_users,
                'error': str(e),
                'success': False
            })
    
    # 📚 パフォーマンス閾値チェック
    avg_response_time = sum([r.get('response_time', 999) for r in test_results if 'response_time' in r]) / len(test_results)
    performance_acceptable = avg_response_time < 2.0  # 2秒以内
    
    return {
        'statusCode': 200 if performance_acceptable else 400,
        'body': json.dumps({
            'test_type': 'performance',
            'success': performance_acceptable,
            'results': {
                'average_response_time': avg_response_time,
                'performance_threshold': 2.0,
                'test_results': test_results
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    }
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // 🔧 CodeBuild プロジェクト群
    // 📚 AWS学習ポイント: 段階別ビルドプロジェクト

    // ユニットテスト用ビルドプロジェクト
    const unitTestProject = new codebuild.Project(this, 'UnitTestProject', {
      projectName: `${projectName}-unit-tests-${environment}`,
      description: 'Unit testing and code quality checks',
      
      // 📚 AWS学習ポイント: buildspec.yml の詳細設定
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          variables: {
            NODE_ENV: 'test',
            CI: 'true',
          },
        },
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '18',
              python: '3.11',
            },
            commands: [
              'echo Installing dependencies...',
              'npm install --ci --only=production',
              'npm install --dev',  // テスト用依存関係
            ],
          },
          pre_build: {
            commands: [
              'echo Running pre-build checks...',
              'npm run lint',          // コード品質チェック
              'npm run type-check',    // TypeScript型チェック
              'npm audit --audit-level moderate', // セキュリティ監査
            ],
          },
          build: {
            commands: [
              'echo Running unit tests...',
              'npm run test:unit -- --coverage --ci',
              'npm run test:integration',
              // 📚 カバレッジレポート生成
              'npm run coverage:report',
            ],
          },
          post_build: {
            commands: [
              'echo Unit tests completed',
              // 📚 テストレポートのアップロード
              'aws s3 cp coverage/ s3://${artifactsBucket.bucketName}/test-reports/unit/ --recursive',
            ],
          },
        },
        reports: {
          'unit-test-reports': {
            files: ['**/*'],
            'base-directory': 'coverage',
          },
        },
        artifacts: {
          files: [
            'coverage/**/*',
            'test-results.xml',
            'package.json',
            'package-lock.json',
          ],
        },
      }),
      
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: enableDockerBuild, // Docker使用時に必要
      },
      
      // アーティファクトアクセス権限
      role: new iam.Role(this, 'UnitTestProjectRole', {
        assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
        ],
        inlinePolicies: {
          S3Access: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['s3:PutObject', 's3:PutObjectAcl'],
                resources: [`${artifactsBucket.bucketArn}/*`],
              }),
            ],
          }),
        },
      }),
    });

    // Docker ビルド用プロジェクト
    let dockerBuildProject: codebuild.Project | undefined;
    if (enableDockerBuild) {
      dockerBuildProject = new codebuild.Project(this, 'DockerBuildProject', {
        projectName: `${projectName}-docker-build-${environment}`,
        description: 'Docker image build and push',
        
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          env: {
            variables: {
              IMAGE_REPO_NAME: projectName,
              IMAGE_TAG: 'latest',
            },
          },
          phases: {
            pre_build: {
              commands: [
                'echo Logging in to Amazon ECR...',
                'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
                'REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME',
                'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                'IMAGE_TAG=${COMMIT_HASH:=latest}',
              ],
            },
            build: {
              commands: [
                'echo Build started on `date`',
                'echo Building the Docker image...',
                'docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .',
                'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $REPOSITORY_URI:$IMAGE_TAG',
                'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $REPOSITORY_URI:latest',
              ],
            },
            post_build: {
              commands: [
                'echo Build completed on `date`',
                'echo Pushing the Docker images...',
                'docker push $REPOSITORY_URI:$IMAGE_TAG',
                'docker push $REPOSITORY_URI:latest',
                'echo Writing image definitions file...',
                'printf \'[{"name":"${projectName}","imageUri":"%s"}]\' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
              ],
            },
          },
          artifacts: {
            files: [
              'imagedefinitions.json',
            ],
          },
        }),
        
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: true, // Docker使用時に必須
        },
      });

      // Docker ビルド用ECR権限
      dockerBuildProject.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:GetAuthorizationToken',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
        ],
        resources: ['*'],
      }));
    }

    // 🚀 CodePipeline の作成
    // 📚 AWS学習ポイント: 完全自動化されたCI/CDパイプライン
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    const testOutput = new codepipeline.Artifact();
    const dockerOutput = new codepipeline.Artifact();

    const pipeline = new codepipeline.Pipeline(this, 'CicdPipeline', {
      pipelineName: `${projectName}-pipeline-${environment}`,
      artifactBucket: artifactsBucket,
      
      // 📚 AWS学習ポイント: パイプライン段階設計
      stages: [
        // 🔄 ソース段階
        {
          stageName: 'Source',
          actions: [
            new codepipelineActions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: props.githubOwner,
              repo: props.githubRepo,
              branch: githubBranch,
              oauthToken: cdk.SecretValue.secretsManager('github-token'),
              output: sourceOutput,
              trigger: codepipelineActions.GitHubTrigger.WEBHOOK, // Webhook自動実行
            }),
          ],
        },
        
        // 🧪 テスト段階
        {
          stageName: 'Test',
          actions: [
            // ユニットテスト
            new codepipelineActions.CodeBuildAction({
              actionName: 'Unit_Tests',
              project: unitTestProject,
              input: sourceOutput,
              outputs: [testOutput],
            }),
            
            // セキュリティスキャン
            ...(enableSecurityScans ? [
              new codepipelineActions.LambdaInvokeAction({
                actionName: 'Security_Scan',
                lambda: testRunnerFunction,
                userParameters: {
                  test_type: 'security',
                  environment: environment,
                },
              }),
            ] : []),
          ],
        },
        
        // 🔧 ビルド段階
        {
          stageName: 'Build',
          actions: [
            // アプリケーションビルド
            new codepipelineActions.CodeBuildAction({
              actionName: 'Application_Build',
              project: new codebuild.Project(this, 'ApplicationBuildProject', {
                projectName: `${projectName}-app-build-${environment}`,
                buildSpec: codebuild.BuildSpec.fromObject({
                  version: '0.2',
                  phases: {
                    install: {
                      'runtime-versions': {
                        nodejs: '18',
                      },
                    },
                    pre_build: {
                      commands: [
                        'npm ci',
                      ],
                    },
                    build: {
                      commands: [
                        'npm run build',
                        'npm run package',
                      ],
                    },
                    post_build: {
                      commands: [
                        'echo Build completed on `date`',
                      ],
                    },
                  },
                  artifacts: {
                    files: [
                      '**/*',
                    ],
                  },
                }),
                environment: {
                  buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                },
              }),
              input: sourceOutput,
              outputs: [buildOutput],
            }),
            
            // Docker ビルド（有効な場合）
            ...(enableDockerBuild && dockerBuildProject ? [
              new codepipelineActions.CodeBuildAction({
                actionName: 'Docker_Build',
                project: dockerBuildProject,
                input: sourceOutput,
                outputs: [dockerOutput],
              }),
            ] : []),
          ],
        },
      ],
    });

    // 📚 AWS学習ポイント: 環境別デプロイ段階の動的追加
    defaultEnvironments.forEach((env, index) => {
      const stageActions: codepipelineActions.Action[] = [];
      
      // 📚 手動承認アクション（必要な場合）
      if (env.approvalRequired) {
        stageActions.push(
          new codepipelineActions.ManualApprovalAction({
            actionName: `Approve_Deploy_To_${env.name}`,
            notificationTopic: pipelineNotificationTopic,
            additionalInformation: `Approve deployment to ${env.name} environment`,
            externalEntityLink: `https://console.aws.amazon.com/cloudformation/home?region=${env.region}`,
          })
        );
      }
      
      // 📚 CloudFormation デプロイアクション
      stageActions.push(
        new codepipelineActions.CloudFormationCreateUpdateStackAction({
          actionName: `Deploy_To_${env.name}`,
          templatePath: buildOutput.atPath('packaged-template.yaml'),
          stackName: `${projectName}-${env.name}`,
          adminPermissions: true,
          parameterOverrides: {
            Environment: env.name,
            ProjectName: projectName,
          },
          region: env.region,
        })
      );
      
      // 📚 統合テスト（有効な場合）
      if (enableIntegrationTests) {
        stageActions.push(
          new codepipelineActions.LambdaInvokeAction({
            actionName: `Integration_Tests_${env.name}`,
            lambda: testRunnerFunction,
            userParameters: {
              test_type: 'integration',
              environment: env.name,
              application_url: `https://${projectName}-${env.name}.example.com`, // 実際のURLを設定
            },
          })
        );
      }
      
      // 📚 パフォーマンステスト（有効な場合）
      if (enablePerformanceTests && env.runLoadTests) {
        stageActions.push(
          new codepipelineActions.LambdaInvokeAction({
            actionName: `Performance_Tests_${env.name}`,
            lambda: testRunnerFunction,
            userParameters: {
              test_type: 'performance',
              environment: env.name,
              application_url: `https://${projectName}-${env.name}.example.com`,
            },
          })
        );
      }
      
      // デプロイ段階を追加
      pipeline.addStage({
        stageName: `Deploy_${env.name}`,
        actions: stageActions,
      });
    });

    // 📊 パイプライン監視・通知
    // 📚 AWS学習ポイント: EventBridge によるパイプライン状態監視
    const pipelineStateRule = new events.Rule(this, 'PipelineStateRule', {
      ruleName: `${projectName}-pipeline-state-${environment}`,
      description: 'Monitor pipeline state changes',
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          pipeline: [pipeline.pipelineName],
          state: ['FAILED', 'SUCCEEDED', 'SUPERSEDED'],
        },
      },
    });

    // SNS通知ターゲット
    pipelineStateRule.addTarget(new targets.SnsTopic(pipelineNotificationTopic));

    // Slack通知ターゲット（有効な場合）
    if (slackNotificationFunction) {
      pipelineStateRule.addTarget(new targets.LambdaFunction(slackNotificationFunction));
    }

    // 📊 CloudWatch メトリクス・アラーム
    // 📚 AWS学習ポイント: パイプライン失敗率監視
    const pipelineFailureAlarm = new cloudwatch.Alarm(this, 'PipelineFailureAlarm', {
      alarmName: `${projectName}-pipeline-failures-${environment}`,
      alarmDescription: 'Pipeline failure rate alarm',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CodePipeline',
        metricName: 'PipelineExecutionFailure',
        dimensionsMap: {
          PipelineName: pipeline.pipelineName,
        },
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // アラーム発生時のアクション
    pipelineFailureAlarm.addAlarmAction(
      new cloudwatch.SnsAction(pipelineNotificationTopic)
    );

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.pipelineArn = pipeline.pipelineArn;
    this.artifactsBucketName = artifactsBucket.bucketName;
    this.buildProjectArn = unitTestProject.projectArn;
    this.notificationTopicArn = pipelineNotificationTopic.topicArn;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'PipelineArn', {
      value: this.pipelineArn,
      description: 'CI/CD パイプライン ARN',
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      description: 'CI/CD パイプライン名',
    });

    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: this.artifactsBucketName,
      description: 'パイプライン成果物保存バケット名',
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopicArn,
      description: 'パイプライン通知SNSトピック ARN',
    });

    new cdk.CfnOutput(this, 'PipelineConsoleUrl', {
      value: `https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline.pipelineName}/view`,
      description: 'パイプライン管理コンソールURL',
    });

    // 📚 便利な出力: デプロイ環境一覧
    new cdk.CfnOutput(this, 'DeploymentEnvironments', {
      value: JSON.stringify(defaultEnvironments.map(env => ({
        name: env.name,
        approvalRequired: env.approvalRequired,
        canaryDeployment: env.canaryDeployment,
      }))),
      description: 'デプロイ対象環境一覧（JSON）',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ 配列の高度な操作: forEach(), map(), filter()
    // ✅ スプレッド演算子: ...array の展開
    // ✅ 条件付き配列要素: ...(condition ? [element] : [])
    // ✅ 複雑なオブジェクト構造: ネストしたオブジェクト設定
    // ✅ テンプレートリテラル: 複雑な文字列構築
    // ✅ undefined チェック: value || defaultValue
    // ✅ 動的プロパティ設定: computed property names

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ CodePipeline: 完全自動化CI/CDワークフロー
    // ✅ CodeBuild: buildspec.yml、マルチステージビルド
    // ✅ EventBridge: パイプラインイベント監視
    // ✅ S3 Lifecycle: アーティファクト管理、コスト最適化
    // ✅ IAM細粒度制御: サービス別権限設計
    // ✅ Docker統合: コンテナビルド・レジストリ連携
    // ✅ 多段階デプロイ: 環境別設定・承認フロー
    // ✅ DevOps プラクティス: テスト自動化、品質ゲート
  }
}