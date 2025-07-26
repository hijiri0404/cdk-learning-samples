// 📚 TypeScript学習ポイント: マルチ環境管理用import
// 環境別設定管理とGitOpsワークフローのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// Systems Manager（パラメータストア）
import * as ssm from 'aws-cdk-lib/aws-ssm';
// Secrets Manager（機密情報管理）
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
// Lambda（設定適用・検証）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// API Gateway（環境管理API）
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// CodePipeline（デプロイパイプライン）
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
// CodeBuild（ビルドプロジェクト）
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';
// S3（アーティファクト保存）
import * as s3 from 'aws-cdk-lib/aws-s3';
// CloudFormation（スタック管理）
import * as cloudformation from 'aws-cdk-lib/aws-cloudformation';
// SNS（通知）
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

// 📚 TypeScript学習ポイント: 環境設定定義
// 各環境の詳細設定を型安全に定義
interface EnvironmentConfig {
  // 環境名
  name: string;
  // アカウントID
  account: string;
  // リージョン
  region: string;
  // ドメイン名
  domainName?: string;
  // インスタンスサイズ
  instanceType: string;
  // 最小・最大インスタンス数
  minCapacity: number;
  maxCapacity: number;
  // 高可用性設定
  multiAz: boolean;
  // バックアップ設定
  backupRetention: number;
  // ログレベル
  logLevel: string;
  // 機能フラグ
  featureFlags: { [key: string]: boolean };
  // リソースタグ
  tags: { [key: string]: string };
}

// 📚 TypeScript学習ポイント: マルチ環境スタック設定インターフェース
interface MultiEnvironmentStackProps extends cdk.StackProps {
  // プロジェクト名
  projectName?: string;
  // 現在の環境名
  environment: string;
  // 全環境設定
  environments?: EnvironmentConfig[];
  // GitHubリポジトリ情報
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  // 通知設定
  notificationEmail?: string;
  // 自動承認設定
  autoApprove?: boolean;
  // 設定変更検証を有効にするか
  enableConfigValidation?: boolean;
}

// 📚 TypeScript学習ポイント: マルチ環境管理メインクラス
export class MultiEnvironmentStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly configApiUrl: string;
  public readonly pipelineArn: string;
  public readonly parameterStorePrefix: string;
  public readonly currentEnvironmentConfig: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: MultiEnvironmentStackProps) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の設定
    const projectName = props.projectName || 'multi-env-project';
    const environment = props.environment;
    const githubOwner = props.githubOwner || 'your-github-username';
    const githubRepo = props.githubRepo || 'your-repo-name';
    const githubBranch = props.githubBranch || 'main';
    const enableConfigValidation = props.enableConfigValidation !== false;
    
    // 📚 TypeScript学習ポイント: デフォルト環境設定の定義
    const defaultEnvironments: EnvironmentConfig[] = props.environments || [
      {
        name: 'dev',
        account: this.account,
        region: this.region,
        instanceType: 't3.micro',
        minCapacity: 1,
        maxCapacity: 2,
        multiAz: false,
        backupRetention: 1,
        logLevel: 'DEBUG',
        featureFlags: {
          newFeatureA: true,
          experimentalFeatureB: true,
          betaFeatureC: false,
        },
        tags: {
          Environment: 'dev',
          Owner: 'development-team',
          CostCenter: 'engineering',
        },
      },
      {
        name: 'staging',
        account: this.account,
        region: this.region,
        instanceType: 't3.small',
        minCapacity: 2,
        maxCapacity: 4,
        multiAz: false,
        backupRetention: 7,
        logLevel: 'INFO',
        featureFlags: {
          newFeatureA: true,
          experimentalFeatureB: false,
          betaFeatureC: true,
        },
        tags: {
          Environment: 'staging',
          Owner: 'qa-team',
          CostCenter: 'engineering',
        },
      },
      {
        name: 'prod',
        account: this.account,
        region: this.region,
        instanceType: 't3.medium',
        minCapacity: 3,
        maxCapacity: 10,
        multiAz: true,
        backupRetention: 30,
        logLevel: 'WARN',
        featureFlags: {
          newFeatureA: true,
          experimentalFeatureB: false,
          betaFeatureC: false,
        },
        tags: {
          Environment: 'prod',
          Owner: 'operations-team',
          CostCenter: 'production',
        },
      },
    ];

    // 📚 TypeScript学習ポイント: 配列検索と分割代入
    const currentEnvironmentConfig = defaultEnvironments.find(env => env.name === environment);
    if (!currentEnvironmentConfig) {
      throw new Error(`Environment configuration not found for: ${environment}`);
    }

    this.currentEnvironmentConfig = currentEnvironmentConfig;
    this.parameterStorePrefix = `/${projectName}/${environment}`;

    // 📚 AWS学習ポイント: Parameter Store による設定管理
    // 各環境の設定をパラメータストアに保存

    // 基本設定パラメータ
    new ssm.StringParameter(this, 'EnvironmentNameParam', {
      parameterName: `${this.parameterStorePrefix}/environment/name`,
      stringValue: currentEnvironmentConfig.name,
      description: '現在の環境名',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'InstanceTypeParam', {
      parameterName: `${this.parameterStorePrefix}/compute/instance-type`,
      stringValue: currentEnvironmentConfig.instanceType,
      description: 'インスタンスタイプ設定',
    });

    new ssm.StringParameter(this, 'LogLevelParam', {
      parameterName: `${this.parameterStorePrefix}/application/log-level`,
      stringValue: currentEnvironmentConfig.logLevel,
      description: 'アプリケーションログレベル',
    });

    // 📚 AWS学習ポイント: 数値パラメータの保存
    new ssm.StringParameter(this, 'MinCapacityParam', {
      parameterName: `${this.parameterStorePrefix}/autoscaling/min-capacity`,
      stringValue: currentEnvironmentConfig.minCapacity.toString(),
      description: '最小キャパシティ',
    });

    new ssm.StringParameter(this, 'MaxCapacityParam', {
      parameterName: `${this.parameterStorePrefix}/autoscaling/max-capacity`,
      stringValue: currentEnvironmentConfig.maxCapacity.toString(),
      description: '最大キャパシティ',
    });

    // 📚 AWS学習ポイント: 機能フラグの管理
    Object.entries(currentEnvironmentConfig.featureFlags).forEach(([flagName, flagValue]) => {
      new ssm.StringParameter(this, `FeatureFlag${flagName}`, {
        parameterName: `${this.parameterStorePrefix}/feature-flags/${flagName}`,
        stringValue: flagValue.toString(),
        description: `機能フラグ: ${flagName}`,
      });
    });

    // 📚 AWS学習ポイント: JSON形式の複雑な設定
    new ssm.StringParameter(this, 'FullConfigParam', {
      parameterName: `${this.parameterStorePrefix}/config/full`,
      stringValue: JSON.stringify(currentEnvironmentConfig, null, 2),
      description: '完全な環境設定（JSON形式）',
      tier: ssm.ParameterTier.ADVANCED, // 大容量データ用
    });

    // 🔐 機密情報の管理（Secrets Manager）
    // 📚 AWS学習ポイント: 環境別機密情報の安全な管理
    const environmentSecrets = new secretsmanager.Secret(this, 'EnvironmentSecrets', {
      secretName: `${projectName}/${environment}/secrets`,
      description: `Environment secrets for ${environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          environment: environment,
          project: projectName,
        }),
        generateStringKey: 'api_key',
        excludeCharacters: '"@/\\\'',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // データベース接続情報
    const databaseSecrets = new secretsmanager.Secret(this, 'DatabaseSecrets', {
      secretName: `${projectName}/${environment}/database`,
      description: `Database credentials for ${environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'admin',
          database: `${projectName}_${environment}`,
          host: `${projectName}-${environment}.cluster-xyz.${this.region}.rds.amazonaws.com`,
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        passwordLength: 20,
      },
    });

    // 📬 通知設定
    const deploymentNotificationTopic = new sns.Topic(this, 'DeploymentNotifications', {
      topicName: `${projectName}-deployment-${environment}`,
      displayName: 'Multi-Environment Deployment Notifications',
    });

    if (props.notificationEmail) {
      deploymentNotificationTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    // 🗄️ アーティファクト保存用S3バケット
    const artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${projectName}-artifacts-${environment}-${this.account}`,
      
      // 📚 AWS学習ポイント: バージョニング（ロールバック対応）
      versioned: true,
      
      // 📚 AWS学習ポイント: ライフサイクル管理
      lifecycleRules: [
        {
          id: 'DeleteOldArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(90), // 90日後に削除
          noncurrentVersionExpiration: cdk.Duration.days(30), // 旧バージョンは30日で削除
        },
      ],
      
      // セキュリティ設定
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ⚡ 設定管理用Lambda関数
    // 📚 AWS学習ポイント: 動的設定取得・検証機能
    const configManagerFunction = new lambda.Function(this, 'ConfigManagerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'config_manager.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os
from datetime import datetime

ssm = boto3.client('ssm')
secrets = boto3.client('secretsmanager')

def lambda_handler(event, context):
    """
    📚 実装内容: 環境設定の取得・更新・検証
    """
    try:
        action = event.get('action', 'get')
        environment = os.environ['ENVIRONMENT']
        project_name = os.environ['PROJECT_NAME']
        parameter_prefix = f'/{project_name}/{environment}'
        
        if action == 'get':
            # 📚 設定の取得
            return get_environment_config(parameter_prefix)
            
        elif action == 'validate':
            # 📚 設定の検証
            return validate_environment_config(parameter_prefix)
            
        elif action == 'update':
            # 📚 設定の更新
            return update_environment_config(parameter_prefix, event.get('config', {}))
            
        elif action == 'compare':
            # 📚 環境間設定比較
            return compare_environments(project_name, event.get('environments', []))
            
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown action: {action}'})
            }
            
    except Exception as e:
        print(f'Config manager error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_environment_config(parameter_prefix):
    """環境設定を取得"""
    try:
        # 📚 Parameter Store から設定を一括取得
        paginator = ssm.get_paginator('get_parameters_by_path')
        page_iterator = paginator.paginate(
            Path=parameter_prefix,
            Recursive=True,
            WithDecryption=True
        )
        
        parameters = {}
        for page in page_iterator:
            for param in page['Parameters']:
                # パラメータ名からプレフィックスを除去
                key = param['Name'].replace(f'{parameter_prefix}/', '')
                parameters[key] = param['Value']
        
        # 📚 機能フラグを個別に取得
        feature_flags = {}
        for key, value in parameters.items():
            if key.startswith('feature-flags/'):
                flag_name = key.replace('feature-flags/', '')
                feature_flags[flag_name] = value.lower() == 'true'
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'environment': parameters.get('environment/name'),
                'config': parameters,
                'feature_flags': feature_flags,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        raise Exception(f'Failed to get config: {str(e)}')

def validate_environment_config(parameter_prefix):
    """設定の整合性を検証"""
    validation_results = []
    
    try:
        # 必須パラメータの存在確認
        required_params = [
            'environment/name',
            'compute/instance-type',
            'application/log-level',
            'autoscaling/min-capacity',
            'autoscaling/max-capacity'
        ]
        
        for param in required_params:
            try:
                response = ssm.get_parameter(Name=f'{parameter_prefix}/{param}')
                validation_results.append({
                    'parameter': param,
                    'status': 'VALID',
                    'value': response['Parameter']['Value']
                })
            except ssm.exceptions.ParameterNotFound:
                validation_results.append({
                    'parameter': param,
                    'status': 'MISSING',
                    'error': 'Parameter not found'
                })
        
        # 📚 数値パラメータの範囲検証
        try:
            min_cap_response = ssm.get_parameter(Name=f'{parameter_prefix}/autoscaling/min-capacity')
            max_cap_response = ssm.get_parameter(Name=f'{parameter_prefix}/autoscaling/max-capacity')
            
            min_capacity = int(min_cap_response['Parameter']['Value'])
            max_capacity = int(max_cap_response['Parameter']['Value'])
            
            if min_capacity > max_capacity:
                validation_results.append({
                    'parameter': 'autoscaling/capacity',
                    'status': 'INVALID',
                    'error': 'Min capacity cannot be greater than max capacity'
                })
            else:
                validation_results.append({
                    'parameter': 'autoscaling/capacity',
                    'status': 'VALID',
                    'message': 'Capacity settings are consistent'
                })
                
        except Exception as e:
            validation_results.append({
                'parameter': 'autoscaling/capacity',
                'status': 'ERROR',
                'error': str(e)
            })
        
        # 検証結果の集計
        total_checks = len(validation_results)
        valid_checks = len([r for r in validation_results if r['status'] == 'VALID'])
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'validation_summary': {
                    'total_checks': total_checks,
                    'valid_checks': valid_checks,
                    'success_rate': f'{(valid_checks/total_checks)*100:.1f}%'
                },
                'validation_results': validation_results,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        raise Exception(f'Validation failed: {str(e)}')

def update_environment_config(parameter_prefix, config_updates):
    """設定の更新"""
    update_results = []
    
    try:
        for key, value in config_updates.items():
            parameter_name = f'{parameter_prefix}/{key}'
            
            try:
                ssm.put_parameter(
                    Name=parameter_name,
                    Value=str(value),
                    Type='String',
                    Overwrite=True,
                    Description=f'Updated via Config Manager at {datetime.utcnow().isoformat()}'
                )
                
                update_results.append({
                    'parameter': key,
                    'status': 'UPDATED',
                    'new_value': str(value)
                })
                
            except Exception as e:
                update_results.append({
                    'parameter': key,
                    'status': 'FAILED',
                    'error': str(e)
                })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'update_results': update_results,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        raise Exception(f'Update failed: {str(e)}')

def compare_environments(project_name, environments):
    """環境間設定比較"""
    comparison_results = {}
    
    for env in environments:
        env_prefix = f'/{project_name}/{env}'
        try:
            # 各環境の設定を取得
            paginator = ssm.get_paginator('get_parameters_by_path')
            page_iterator = paginator.paginate(
                Path=env_prefix,
                Recursive=True
            )
            
            env_config = {}
            for page in page_iterator:
                for param in page['Parameters']:
                    key = param['Name'].replace(f'{env_prefix}/', '')
                    env_config[key] = param['Value']
            
            comparison_results[env] = env_config
            
        except Exception as e:
            comparison_results[env] = {'error': str(e)}
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'environment_comparison': comparison_results,
            'timestamp': datetime.utcnow().isoformat()
        })
    }
      `),
      environment: {
        ENVIRONMENT: environment,
        PROJECT_NAME: projectName,
        PARAMETER_PREFIX: this.parameterStorePrefix,
      },
      timeout: cdk.Duration.minutes(2),
    });

    // 📚 AWS学習ポイント: Lambda の Parameter Store・Secrets Manager アクセス権限
    configManagerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
        'ssm:PutParameter',
        'ssm:DeleteParameter',
        'ssm:DescribeParameters',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/${projectName}/*`,
      ],
    }));

    configManagerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [
        environmentSecrets.secretArn,
        databaseSecrets.secretArn,
      ],
    }));

    // 🌐 環境管理API
    // 📚 AWS学習ポイント: 設定管理のためのRESTful API
    const configApi = new apigateway.RestApi(this, 'ConfigManagementApi', {
      restApiName: `${projectName}-config-api-${environment}`,
      description: 'Multi-Environment Configuration Management API',
      deployOptions: {
        stageName: environment,
      },
    });

    const configIntegration = new apigateway.LambdaIntegration(configManagerFunction);

    // /config エンドポイント
    const configResource = configApi.root.addResource('config');
    
    // GET /config - 設定取得
    configResource.addMethod('GET', configIntegration);
    
    // POST /config - 設定更新
    configResource.addMethod('POST', configIntegration);

    // /config/validate エンドポイント
    const validateResource = configResource.addResource('validate');
    validateResource.addMethod('GET', configIntegration);

    // /config/compare エンドポイント
    const compareResource = configResource.addResource('compare');
    compareResource.addMethod('POST', configIntegration);

    // 🚀 CodeBuild プロジェクト
    // 📚 AWS学習ポイント: 環境別ビルド設定
    const buildProject = new codebuild.Project(this, 'BuildProject', {
      projectName: `${projectName}-build-${environment}`,
      description: `Build project for ${environment} environment`,
      
      // 📚 AWS学習ポイント: buildspec.yml の動的生成
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          variables: {
            ENVIRONMENT: environment,
            PROJECT_NAME: projectName,
          },
          'parameter-store': [
            `${this.parameterStorePrefix}/environment/name`,
            `${this.parameterStorePrefix}/compute/instance-type`,
            `${this.parameterStorePrefix}/application/log-level`,
          ],
        },
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws --version',
              'echo $ENVIRONMENT',
              // 📚 設定検証
              'echo "Validating environment configuration..."',
              `aws lambda invoke --function-name ${configManagerFunction.functionName} --payload '{"action": "validate"}' response.json`,
              'cat response.json',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building the application...',
              // 📚 環境別ビルド
              'npm install',
              'npm run build',
              'npm run test',
              // 📚 CDK デプロイ準備
              'npm run cdk synth',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              // 📚 デプロイ後の設定確認
              `aws lambda invoke --function-name ${configManagerFunction.functionName} --payload '{"action": "get"}' final-config.json`,
              'cat final-config.json',
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
        privileged: true, // Docker使用時に必要
      },
      
      // 環境変数
      environmentVariables: {
        ENVIRONMENT: {
          value: environment,
        },
        PROJECT_NAME: {
          value: projectName,
        },
      },
    });

    // 📚 AWS学習ポイント: CodeBuild の Parameter Store アクセス権限
    buildProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/${projectName}/*`,
      ],
    }));

    buildProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction',
      ],
      resources: [
        configManagerFunction.functionArn,
      ],
    }));

    // 🔄 CodePipeline（GitOps ワークフロー）
    // 📚 AWS学習ポイント: 環境別自動デプロイパイプライン
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    const pipeline = new codepipeline.Pipeline(this, 'DeploymentPipeline', {
      pipelineName: `${projectName}-pipeline-${environment}`,
      artifactBucket: artifactsBucket,
      
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipelineActions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: githubOwner,
              repo: githubRepo,
              branch: githubBranch,
              oauthToken: cdk.SecretValue.secretsManager('github-token'),
              output: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'Build',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipelineActions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy',
              templatePath: buildOutput.atPath('template.yaml'),
              stackName: `${projectName}-${environment}`,
              adminPermissions: true,
              parameterOverrides: {
                Environment: environment,
                ProjectName: projectName,
              },
            }),
          ],
        },
      ],
    });

    // パイプライン実行結果を SNS で通知
    pipeline.onStateChange('PipelineStateChange', {
      target: new targets.SnsTopic(deploymentNotificationTopic),
    });

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.configApiUrl = configApi.url;
    this.pipelineArn = pipeline.pipelineArn;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'ConfigApiUrl', {
      value: this.configApiUrl,
      description: '環境設定管理API URL',
    });

    new cdk.CfnOutput(this, 'PipelineArn', {
      value: this.pipelineArn,
      description: 'デプロイパイプライン ARN',
    });

    new cdk.CfnOutput(this, 'ParameterStorePrefix', {
      value: this.parameterStorePrefix,
      description: 'Parameter Store プレフィックス',
    });

    new cdk.CfnOutput(this, 'EnvironmentSecretsArn', {
      value: environmentSecrets.secretArn,
      description: '環境別機密情報 ARN',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretsArn', {
      value: databaseSecrets.secretArn,
      description: 'データベース機密情報 ARN',
    });

    // 📚 便利な出力: 環境設定サマリー
    new cdk.CfnOutput(this, 'EnvironmentSummary', {
      value: JSON.stringify({
        name: currentEnvironmentConfig.name,
        instanceType: currentEnvironmentConfig.instanceType,
        capacity: `${currentEnvironmentConfig.minCapacity}-${currentEnvironmentConfig.maxCapacity}`,
        multiAz: currentEnvironmentConfig.multiAz,
        logLevel: currentEnvironmentConfig.logLevel,
      }),
      description: '現在の環境設定サマリー（JSON）',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ find() メソッド: 配列から条件に合う要素を検索
    // ✅ Object.entries(): オブジェクトをキー・値のペア配列に変換
    // ✅ forEach() ループ: 配列の各要素に対する処理
    // ✅ toString(): 数値を文字列に変換
    // ✅ JSON.stringify(): オブジェクトをJSON文字列に変換
    // ✅ エラーハンドリング: throw new Error()
    // ✅ テンプレートリテラル: ${} を使った文字列補間

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ Parameter Store: 階層的設定管理、型別パラメータ
    // ✅ Secrets Manager: 機密情報の自動ローテーション
    // ✅ CodePipeline: GitOpsワークフロー、多段階デプロイ
    // ✅ CodeBuild: buildspec.yml、環境変数、Parameter Store連携
    // ✅ 環境別設定: dev/staging/prod の適切な分離
    // ✅ 設定検証: 整合性チェック、バリデーション
    // ✅ GitOps: Git中心の自動デプロイフロー
    // ✅ Infrastructure as Code: 設定もコードで管理
  }
}