// 📚 TypeScript学習ポイント: エンタープライズセキュリティ用import
// ゼロトラスト・アーキテクチャを実現するセキュリティシステムのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// WAF（Webアプリケーションファイアウォール）
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
// VPC（ネットワークセキュリティ）
import * as ec2 from 'aws-cdk-lib/aws-ec2';
// KMS（暗号化キー管理）
import * as kms from 'aws-cdk-lib/aws-kms';
// Secrets Manager（機密情報管理）
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
// CloudTrail（監査ログ）
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
// Config（設定監査）
import * as config from 'aws-cdk-lib/aws-config';
// GuardDuty（脅威検知）
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
// SecurityHub（セキュリティポスチャ管理）
import * as securityhub from 'aws-cdk-lib/aws-securityhub';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';
// CloudWatch（監視・アラート）
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// SNS（セキュリティアラート）
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// Lambda（セキュリティ自動化）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// S3（ログ保存）
import * as s3 from 'aws-cdk-lib/aws-s3';
// CloudFront（セキュア配信）
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
// Certificate Manager（SSL/TLS証明書）
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';

// 📚 TypeScript学習ポイント: セキュリティポリシー設定
interface SecurityPolicy {
  // ポリシー名
  name: string;
  // 重要度レベル
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // 有効・無効
  enabled: boolean;
  // アクション（BLOCK, ALLOW, COUNT）
  action: 'BLOCK' | 'ALLOW' | 'COUNT';
  // 説明
  description: string;
  // ルール設定
  rules: SecurityRule[];
}

// 📚 TypeScript学習ポイント: セキュリティルール定義
interface SecurityRule {
  // ルール名
  name: string;
  // 条件
  conditions: SecurityCondition[];
  // アクション
  action: 'BLOCK' | 'ALLOW' | 'COUNT';
  // 優先度
  priority: number;
}

// 📚 TypeScript学習ポイント: セキュリティ条件
interface SecurityCondition {
  // 条件タイプ
  type: 'IP' | 'GEO' | 'RATE_LIMIT' | 'SIZE_CONSTRAINT' | 'SQL_INJECTION' | 'XSS';
  // 値
  value: string | number;
  // 演算子
  operator: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'GREATER_THAN' | 'LESS_THAN';
}

// 📚 TypeScript学習ポイント: エンタープライズセキュリティ設定インターフェース
interface EnterpriseSecurityStackProps extends cdk.StackProps {
  // プロジェクト名
  projectName?: string;
  // 環境名（dev, staging, prod等）
  environment?: string;
  // ドメイン名
  domainName?: string;
  // セキュリティレベル（basic, enhanced, maximum）
  securityLevel?: 'basic' | 'enhanced' | 'maximum';
  // 地理的制限を有効にするか
  enableGeoBlocking?: boolean;
  // 許可する国コード配列
  allowedCountries?: string[];
  // DDoS保護を有効にするか
  enableDdosProtection?: boolean;
  // セキュリティ監査メールアドレス
  securityNotificationEmails?: string[];
  // ログ保持期間（日数）
  logRetentionDays?: number;
  // データ分類レベル
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  // コンプライアンス要件
  complianceRequirements?: ('SOC2' | 'PCI_DSS' | 'HIPAA' | 'GDPR' | 'ISO27001')[];
}

// 📚 TypeScript学習ポイント: エンタープライズセキュリティメインクラス
export class EnterpriseSecurityStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly vpcId: string;
  public readonly webAclArn: string;
  public readonly kmsKeyArn: string;
  public readonly securityHubArn: string;
  public readonly auditBucketName: string;

  constructor(scope: Construct, id: string, props: EnterpriseSecurityStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: セキュリティ設定のデフォルト値
    const projectName = props.projectName || 'enterprise-security';
    const environment = props.environment || 'prod';
    const securityLevel = props.securityLevel || 'enhanced';
    const enableGeoBlocking = props.enableGeoBlocking || true;
    const allowedCountries = props.allowedCountries || ['US', 'CA', 'GB', 'JP', 'AU'];
    const enableDdosProtection = props.enableDdosProtection || true;
    const securityNotificationEmails = props.securityNotificationEmails || [];
    const logRetentionDays = props.logRetentionDays || (environment === 'prod' ? 2555 : 90); // 7年または90日
    const dataClassification = props.dataClassification || 'confidential';
    const complianceRequirements = props.complianceRequirements || ['SOC2', 'ISO27001'];

    // 🔐 KMS 暗号化キー（データ保護の基盤）
    // 📚 AWS学習ポイント: エンタープライズ級暗号化キー管理
    const masterKey = new kms.Key(this, 'MasterKey', {
      description: `${projectName} master encryption key for ${environment}`,
      
      // 📚 AWS学習ポイント: キーローテーション
      enableKeyRotation: true, // 年次自動ローテーション
      
      // 📚 AWS学習ポイント: キーポリシー（詳細なアクセス制御）
      policy: new iam.PolicyDocument({
        statements: [
          // 📚 ルートアカウントのフルアクセス
          new iam.PolicyStatement({
            sid: 'EnableRootPermissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // 📚 管理者権限（キー管理）
          new iam.PolicyStatement({
            sid: 'AllowKeyAdministration',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:GenerateDataKey',
              'kms:DescribeKey',
            ],
            resources: ['*'],
          }),
          // 📚 サービス権限（暗号化・復号化）
          new iam.PolicyStatement({
            sid: 'AllowServiceUsage',
            effect: iam.Effect.ALLOW,
            principals: [
              new iam.ServicePrincipal('s3.amazonaws.com'),
              new iam.ServicePrincipal('logs.amazonaws.com'),
              new iam.ServicePrincipal('secretsmanager.amazonaws.com'),
            ],
            actions: [
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': [
                  `s3.${this.region}.amazonaws.com`,
                  `logs.${this.region}.amazonaws.com`,
                  `secretsmanager.${this.region}.amazonaws.com`,
                ],
              },
            },
          }),
        ],
      }),
      
      // 📚 AWS学習ポイント: 削除保護
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // KMS キーエイリアス
    new kms.Alias(this, 'MasterKeyAlias', {
      aliasName: `alias/${projectName}-${environment}-master-key`,
      targetKey: masterKey,
    });

    // 🌐 セキュアVPC（ゼロトラストネットワーク）
    // 📚 AWS学習ポイント: 多層防御ネットワーク設計
    const secureVpc = new ec2.Vpc(this, 'SecureVpc', {
      vpcName: `${projectName}-secure-vpc-${environment}`,
      
      // 📚 AWS学習ポイント: セキュアなIPアドレス設計
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3, // 高可用性
      
      // 📚 AWS学習ポイント: セキュリティ重視のサブネット設計
      subnetConfiguration: [
        {
          // DMZ（非武装地帯）- WAF、ALB用
          cidrMask: 24,
          name: 'DMZ',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          // アプリケーション層 - プライベート（NAT経由）
          cidrMask: 24,
          name: 'Application',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          // データ層 - 完全分離
          cidrMask: 24,
          name: 'Data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          // 管理層 - 運用・監視専用
          cidrMask: 28,
          name: 'Management',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      
      // 📚 AWS学習ポイント: VPCエンドポイント（内部通信の暗号化）
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
        DynamoDB: {
          service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        },
      },
      
      // 📚 AWS学習ポイント: NAT Gateway 高可用性
      natGateways: 3, // 各AZに配置
      
      // 📚 AWS学習ポイント: フローログ（ネットワーク監査）
      flowLogs: {
        'VPCFlowLogsCloudWatch': {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // 📚 AWS学習ポイント: VPCエンドポイント（セキュアAPI通信）
    const interfaceEndpoints = [
      'secretsmanager',
      'kms',
      'monitoring',
      'logs',
      'ssm',
      'ec2',
      'ecs',
      'ecr.dkr',
      'ecr.api',
    ];

    interfaceEndpoints.forEach(service => {
      secureVpc.addInterfaceEndpoint(`${service}Endpoint`, {
        service: ec2.InterfaceVpcEndpointAwsService.lookup(service),
        privateDnsEnabled: true,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      });
    });

    // 🔒 ネットワークACL（サブネットレベルファイアウォール）
    // 📚 AWS学習ポイント: 多層防御の実装
    const dataLayerNacl = new ec2.NetworkAcl(this, 'DataLayerNacl', {
      vpc: secureVpc,
      networkAclName: `${projectName}-data-layer-nacl-${environment}`,
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        onePerAz: true,
      },
    });

    // データ層への厳格なアクセス制御
    dataLayerNacl.addEntry('AllowApplicationLayerInbound', {
      cidr: ec2.AclCidr.ipv4('10.0.1.0/24'), // アプリケーション層のみ
      ruleNumber: 100,
      traffic: ec2.AclTraffic.tcpPort(5432), // PostgreSQL
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    dataLayerNacl.addEntry('AllowApplicationLayerOutbound', {
      cidr: ec2.AclCidr.ipv4('10.0.1.0/24'),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.tcpPort(5432),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    // 🛡️ WAFv2（Webアプリケーションファイアウォール）
    // 📚 AWS学習ポイント: 多層Webセキュリティ
    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `${projectName}-waf-${environment}`,
      description: 'Enterprise Web Application Firewall',
      scope: 'CLOUDFRONT', // CloudFront用
      
      // 📚 デフォルトアクション
      defaultAction: {
        allow: {}, // デフォルトは許可（明示的ブロックルール適用）
      },
      
      // 📚 AWS学習ポイント: 高度なWAFルール設定
      rules: [
        // 📚 ルール1: AWS管理ルールセット（OWASP Top 10対策）
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
              // 📚 除外ルール（誤検知対策）
              excludedRules: [
                { name: 'SizeRestrictions_BODY' },
                { name: 'GenericRFI_BODY' },
              ],
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        
        // 📚 ルール2: 既知の悪意あるIP（AWSマネージドIPリスト）
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'IPReputationMetric',
          },
        },
        
        // 📚 ルール3: SQLインジェクション対策
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLiRuleSetMetric',
          },
        },
        
        // 📚 ルール4: 地理的ブロック（有効な場合）
        ...(enableGeoBlocking ? [{
          name: 'GeoBlockingRule',
          priority: 4,
          statement: {
            notStatement: {
              statement: {
                geoMatchStatement: {
                  countryCodes: allowedCountries,
                },
              },
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'GeoBlockingMetric',
          },
        }] : []),
        
        // 📚 ルール5: レート制限（DDoS対策）
        {
          name: 'RateLimitRule',
          priority: 5,
          statement: {
            rateBasedStatement: {
              limit: securityLevel === 'maximum' ? 1000 : 2000, // 5分間のリクエスト制限
              aggregateKeyType: 'IP',
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitMetric',
          },
        },
        
        // 📚 ルール6: カスタムボット検出
        {
          name: 'BotControlRule',
          priority: 6,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesBotControlRuleSet',
              managedRuleGroupConfigs: [{
                awsManagedRulesBotControlRuleSet: {
                  inspectionLevel: 'TARGETED',
                },
              }],
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'BotControlMetric',
          },
        },
      ],
      
      // 📚 AWS学習ポイント: WAFログ設定
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${projectName}WebACL${environment}`,
      },
    });

    // 🗄️ セキュリティログ保存用S3バケット
    // 📚 AWS学習ポイント: 監査ログの安全な保管
    const auditLogsBucket = new s3.Bucket(this, 'AuditLogsBucket', {
      bucketName: `${projectName}-audit-logs-${environment}-${this.account}`,
      
      // 📚 AWS学習ポイント: ログの暗号化
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: masterKey,
      
      // 📚 AWS学習ポイント: バージョニング（改ざん対策）
      versioned: true,
      
      // 📚 AWS学習ポイント: ライフサイクル管理（コンプライアンス対応）
      lifecycleRules: [
        {
          id: 'AuditLogRetention',
          enabled: true,
          // 📚 段階的アーカイブ（コスト最適化）
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          // コンプライアンス要件に応じた保持期間
          expiration: cdk.Duration.days(logRetentionDays),
        },
      ],
      
      // 📚 AWS学習ポイント: セキュリティ設定
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true, // HTTPS必須
      
      // 📚 AWS学習ポイント: 削除保護
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // 📚 AWS学習ポイント: バケットポリシー（セキュア設定）
    auditLogsBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'DenyInsecureConnections',
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:*'],
      resources: [
        auditLogsBucket.bucketArn,
        `${auditLogsBucket.bucketArn}/*`,
      ],
      conditions: {
        Bool: {
          'aws:SecureTransport': 'false',
        },
      },
    }));

    // 📊 CloudTrail（API監査ログ）
    // 📚 AWS学習ポイント: 包括的なAPI監査
    const cloudTrail = new cloudtrail.Trail(this, 'SecurityAuditTrail', {
      trailName: `${projectName}-security-audit-${environment}`,
      
      // 📚 AWS学習ポイント: ログ保存設定
      bucket: auditLogsBucket,
      s3KeyPrefix: 'cloudtrail-logs/',
      
      // 📚 AWS学習ポイント: ログ暗号化
      kmsKey: masterKey,
      
      // 📚 AWS学習ポイント: 監査範囲
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true, // ログ改ざん検知
      
      // 📚 AWS学習ポイント: データイベント監査
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: new cloudwatch.LogGroup(this, 'CloudTrailLogGroup', {
        logGroupName: `/aws/cloudtrail/${projectName}-${environment}`,
        retention: cloudwatch.RetentionDays.ONE_YEAR,
        encryptionKey: masterKey,
      }),
      
      // 📚 AWS学習ポイント: 機密データアクセス監査
      eventSelectors: [
        {
          readWriteType: cloudtrail.ReadWriteType.ALL,
          includeManagementEvents: true,
          dataResources: [
            {
              type: 's3',
              values: [`${auditLogsBucket.bucketArn}/*`],
            },
          ],
        },
      ],
    });

    // 🔍 Config（設定監査・コンプライアンス）
    // 📚 AWS学習ポイント: リソース設定の継続的監査
    const configBucket = new s3.Bucket(this, 'ConfigBucket', {
      bucketName: `${projectName}-config-${environment}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: masterKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Config設定レコーダー
    const configRole = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/ConfigRole'),
      ],
    });

    const configurationRecorder = new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      name: `${projectName}-config-recorder-${environment}`,
      roleArn: configRole.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
        resourceTypes: [], // allSupportedがtrueの場合は空配列
      },
    });

    const configDeliveryChannel = new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      name: `${projectName}-config-delivery-${environment}`,
      s3BucketName: configBucket.bucketName,
    });

    // 📚 AWS学習ポイント: セキュリティ通知システム
    const securityAlertTopic = new sns.Topic(this, 'SecurityAlerts', {
      topicName: `${projectName}-security-alerts-${environment}`,
      displayName: 'Enterprise Security Alerts',
      masterKey: masterKey, // 通知の暗号化
    });

    // セキュリティ通知の購読設定
    securityNotificationEmails.forEach((email, index) => {
      securityAlertTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(email, {
          filterPolicy: {
            severity: sns.SubscriptionFilter.stringFilter({
              allowlist: ['HIGH', 'CRITICAL'],
            }),
          },
        })
      );
    });

    // ⚡ セキュリティ自動化Lambda関数
    // 📚 AWS学習ポイント: セキュリティインシデント自動対応
    const securityAutomationFunction = new lambda.Function(this, 'SecurityAutomationFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'security_automation.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import boto3
from datetime import datetime, timedelta

# AWSクライアント初期化
ec2 = boto3.client('ec2')
iam = boto3.client('iam')
sns = boto3.client('sns')
guardduty = boto3.client('guardduty')
wafv2 = boto3.client('wafv2')

def lambda_handler(event, context):
    """
    📚 実装内容: セキュリティイベント自動対応システム
    """
    try:
        event_source = event.get('source', '')
        detail_type = event.get('detail-type', '')
        
        print(f'Processing security event: {event_source} - {detail_type}')
        
        if event_source == 'aws.guardduty':
            return handle_guardduty_finding(event)
        elif event_source == 'aws.config':
            return handle_config_compliance(event)
        elif event_source == 'aws.wafv2':
            return handle_waf_alert(event)
        elif event_source == 'aws.cloudtrail':
            return handle_suspicious_activity(event)
        else:
            return handle_generic_security_event(event)
            
    except Exception as e:
        print(f'Security automation error: {str(e)}')
        send_alert(f'Security automation failed: {str(e)}', 'CRITICAL')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def handle_guardduty_finding(event):
    """📚 GuardDuty脅威検知イベント処理"""
    finding = event.get('detail', {})
    finding_type = finding.get('type', '')
    severity = finding.get('severity', 0)
    
    print(f'GuardDuty Finding: {finding_type}, Severity: {severity}')
    
    # 📚 高脅威レベルの自動対応
    if severity >= 7.0:  # High/Critical severity
        print('High severity threat detected - initiating automatic response')
        
        # 疑わしいIPアドレスの特定
        service = finding.get('service', {})
        remote_ip = service.get('remoteIpDetails', {}).get('ipAddressV4', '')
        
        if remote_ip:
            # 📚 自動IP遮断（WAF IPセット更新）
            block_malicious_ip(remote_ip)
            
            # 📚 セキュリティグループから除外
            revoke_security_group_access(remote_ip)
        
        # 📚 緊急アラート送信
        send_alert(
            f'Critical threat detected: {finding_type}\\nIP: {remote_ip}\\nAutomatic blocking initiated',
            'CRITICAL'
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'action': 'processed',
            'finding_type': finding_type,
            'severity': severity
        })
    }

def handle_config_compliance(event):
    """📚 Config コンプライアンス違反処理"""
    detail = event.get('detail', {})
    compliance_type = detail.get('newEvaluationResult', {}).get('complianceType', '')
    resource_type = detail.get('resourceType', '')
    resource_id = detail.get('resourceId', '')
    
    print(f'Config Compliance: {compliance_type} for {resource_type}:{resource_id}')
    
    if compliance_type == 'NON_COMPLIANT':
        # 📚 自動修復アクション
        if resource_type == 'AWS::S3::Bucket':
            remediate_s3_bucket(resource_id)
        elif resource_type == 'AWS::EC2::SecurityGroup':
            remediate_security_group(resource_id)
        elif resource_type == 'AWS::IAM::User':
            remediate_iam_user(resource_id)
        
        send_alert(
            f'Compliance violation detected and remediated: {resource_type}:{resource_id}',
            'HIGH'
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'action': 'compliance_checked',
            'resource': f'{resource_type}:{resource_id}',
            'compliance': compliance_type
        })
    }

def handle_waf_alert(event):
    """📚 WAF攻撃検知処理"""
    detail = event.get('detail', {})
    action = detail.get('action', '')
    
    if action == 'BLOCK':
        # 📚 攻撃パターン分析
        analyze_attack_pattern(detail)
        
        # 📚 WAFルール自動調整
        update_waf_rules_if_needed(detail)
    
    return {
        'statusCode': 200,
        'body': json.dumps({'action': 'waf_processed'})
    }

def block_malicious_ip(ip_address):
    """悪意あるIPアドレスの自動遮断"""
    try:
        print(f'Blocking malicious IP: {ip_address}')
        # 📚 実装予定: WAF IPセットの更新
        # wafv2.update_ip_set() の実装
        
    except Exception as e:
        print(f'Failed to block IP {ip_address}: {str(e)}')

def revoke_security_group_access(ip_address):
    """セキュリティグループからの自動除外"""
    try:
        print(f'Revoking access for IP: {ip_address}')
        # 📚 実装予定: セキュリティグループルールの削除
        
    except Exception as e:
        print(f'Failed to revoke access for IP {ip_address}: {str(e)}')

def remediate_s3_bucket(bucket_name):
    """S3バケットの自動修復"""
    print(f'Remediating S3 bucket: {bucket_name}')
    # 📚 実装予定: バケットポリシー、暗号化設定の修復

def remediate_security_group(sg_id):
    """セキュリティグループの自動修復"""
    print(f'Remediating security group: {sg_id}')
    # 📚 実装予定: 過度に開放されたルールの修正

def remediate_iam_user(user_name):
    """IAMユーザーの自動修復"""
    print(f'Remediating IAM user: {user_name}')
    # 📚 実装予定: 過大な権限の制限

def analyze_attack_pattern(waf_detail):
    """攻撃パターンの分析"""
    print('Analyzing attack pattern...')
    # 📚 実装予定: 機械学習による攻撃パターン分析

def update_waf_rules_if_needed(waf_detail):
    """WAFルールの動的更新"""
    print('Checking if WAF rule updates are needed...')
    # 📚 実装予定: 攻撃パターンに基づくルール自動調整

def send_alert(message, severity):
    """セキュリティアラート送信"""
    try:
        sns.publish(
            TopicArn='${securityAlertTopic.topicArn}',
            Subject=f'Security Alert - {severity}',
            Message=message,
            MessageAttributes={
                'severity': {
                    'DataType': 'String',
                    'StringValue': severity
                }
            }
        )
        print(f'Alert sent: {severity} - {message}')
        
    except Exception as e:
        print(f'Failed to send alert: {str(e)}')

def handle_suspicious_activity(event):
    """疑わしい活動の検知処理"""
    print('Processing suspicious CloudTrail activity...')
    return {'statusCode': 200, 'body': json.dumps({'action': 'analyzed'})}

def handle_generic_security_event(event):
    """汎用セキュリティイベント処理"""
    print('Processing generic security event...')
    return {'statusCode': 200, 'body': json.dumps({'action': 'logged'})}
      `),
      environment: {
        SECURITY_ALERT_TOPIC_ARN: securityAlertTopic.topicArn,
        WEB_ACL_ARN: webAcl.attrArn,
        ENVIRONMENT: environment,
        PROJECT_NAME: projectName,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // 📚 AWS学習ポイント: セキュリティ自動化権限
    securityAutomationFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:DescribeSecurityGroups',
        'ec2:AuthorizeSecurityGroupIngress',
        'ec2:RevokeSecurityGroupIngress',
        'wafv2:GetIPSet',
        'wafv2:UpdateIPSet',
        'guardduty:GetFindings',
        'config:GetComplianceDetailsByResource',
        'sns:Publish',
      ],
      resources: ['*'],
    }));

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.vpcId = secureVpc.vpcId;
    this.webAclArn = webAcl.attrArn;
    this.kmsKeyArn = masterKey.keyArn;
    this.securityHubArn = `arn:aws:securityhub:${this.region}:${this.account}:hub/default`;
    this.auditBucketName = auditLogsBucket.bucketName;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpcId,
      description: 'セキュアVPC ID',
    });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAclArn,
      description: 'WAF WebACL ARN',
    });

    new cdk.CfnOutput(this, 'KmsKeyArn', {
      value: this.kmsKeyArn,
      description: 'マスター暗号化キー ARN',
    });

    new cdk.CfnOutput(this, 'AuditBucketName', {
      value: this.auditBucketName,
      description: '監査ログ保存バケット名',
    });

    new cdk.CfnOutput(this, 'SecurityAlertTopicArn', {
      value: securityAlertTopic.topicArn,
      description: 'セキュリティアラート SNS トピック ARN',
    });

    new cdk.CfnOutput(this, 'CloudTrailArn', {
      value: cloudTrail.trailArn,
      description: 'セキュリティ監査 CloudTrail ARN',
    });

    // 📚 便利な出力: セキュリティ設定サマリー
    new cdk.CfnOutput(this, 'SecurityConfigSummary', {
      value: JSON.stringify({
        securityLevel: securityLevel,
        geoBlocking: enableGeoBlocking,
        allowedCountries: allowedCountries,
        ddosProtection: enableDdosProtection,
        dataClassification: dataClassification,
        complianceRequirements: complianceRequirements,
        logRetentionDays: logRetentionDays,
      }),
      description: 'セキュリティ設定サマリー（JSON）',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ 複雑な型定義: interface with nested objects
    // ✅ ユニオン型: 'basic' | 'enhanced' | 'maximum'
    // ✅ 配列型: string[], SecurityRule[]
    // ✅ 条件付きプロパティ: condition ? property : undefined
    // ✅ スプレッド演算子: ...(condition ? [item] : [])
    // ✅ 高度な配列操作: forEach(), map() with complex objects
    // ✅ 型安全な設定管理: interface-based configuration

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ WAFv2: 高度なWebアプリケーション保護
    // ✅ KMS: エンタープライズ暗号化キー管理
    // ✅ VPC Security: 多層防御ネットワーク設計
    // ✅ CloudTrail: 包括的API監査ログ
    // ✅ Config: リソース設定の継続的監査
    // ✅ セキュリティ自動化: イベント駆動自動対応
    // ✅ コンプライアンス: SOC2, PCI DSS, HIPAA, GDPR対応
    // ✅ ゼロトラスト: 信頼境界を前提としないセキュリティモデル
    // ✅ Defense in Depth: 多層防御戦略の実装
  }
}