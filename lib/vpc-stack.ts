// TypeScript: VPC（ネットワーク）関連のライブラリをimport
import * as cdk from 'aws-cdk-lib';        // CDKメインライブラリ
import * as ec2 from 'aws-cdk-lib/aws-ec2'; // EC2/VPC関連のライブラリ
import { Construct } from 'constructs';     // 基本コンストラクト

// TypeScript: VPCスタッククラスの定義
export class VpcStack extends cdk.Stack {
  // TypeScript: publicは他のクラスからアクセス可能
  // readonlyは読み取り専用（変更不可）
  // 型指定: vpc変数はec2.Vpc型
  public readonly vpc: ec2.Vpc;

  // コンストラクタ
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props); // 親クラスの初期化

    // 基本的なVPC
    // TypeScript: this.vpcに代入することで、他のメソッドからも参照可能
    this.vpc = new ec2.Vpc(this, 'LearningVpc', {
      ipProtocol: ec2.IpProtocol.DUAL_STACK,     // IPv4とIPv6の両方を使用
      maxAzs: 2,                                 // 2つのアベイラビリティーゾーンを使用
      cidr: '10.0.0.0/16',                       // VPCのIPアドレス範囲
      
      // TypeScript: 配列は[]で表現、オブジェクトの配列は[{}, {}, {}]
      subnetConfiguration: [                     // サブネット設定の配列
        {
          cidrMask: 24,                          // サブネットマスク
          name: 'Public',                        // サブネット名
          subnetType: ec2.SubnetType.PUBLIC,     // パブリックサブネット
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // プライベートサブネット（外部アクセス可能）
        },
        {
          cidrMask: 28,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,    // 完全に分離されたサブネット
        },
      ],

      natGateways: 1,                            // NATゲートウェイの数（数値型）

      // TypeScript: ネストしたオブジェクト（オブジェクトの中にオブジェクト）
      flowLogs: {                                // VPCフローログの設定
        cloudwatch: {                            // CloudWatchへのログ送信設定
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // セキュリティグループ（Web層）
    const webSecurityGroup = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc: this.vpc,
      description: 'Web層用のセキュリティグループ',
      allowAllOutbound: true,
    });

    // HTTP/HTTPSアクセスを許可
    webSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP traffic from anywhere'
    );
    webSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS traffic from anywhere'
    );

    // セキュリティグループ（アプリケーション層）
    const appSecurityGroup = new ec2.SecurityGroup(this, 'AppSecurityGroup', {
      vpc: this.vpc,
      description: 'アプリケーション層用のセキュリティグループ',
      allowAllOutbound: true,
    });

    // Web層からのアクセスのみ許可
    appSecurityGroup.addIngressRule(
      webSecurityGroup,
      ec2.Port.tcp(8080),
      'Application traffic from web layer'
    );

    // セキュリティグループ（データベース層）
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'データベース層用のセキュリティグループ',
      allowAllOutbound: false,
    });

    // アプリケーション層からのデータベースアクセスのみ許可
    dbSecurityGroup.addIngressRule(
      appSecurityGroup,
      ec2.Port.tcp(3306),
      'MySQL traffic from application layer'
    );
    dbSecurityGroup.addIngressRule(
      appSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL traffic from application layer'
    );

    // VPCエンドポイント（S3）
    const s3Endpoint = this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // VPCエンドポイント（DynamoDB）
    const dynamoEndpoint = this.vpc.addGatewayEndpoint('DynamoEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // 出力
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'LearningVpcId',
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      // TypeScript: 配列操作のメソッドチェーン
      // map()は配列の各要素を変換、join()は配列を文字列に結合
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'パブリックサブネットのID一覧',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      // TypeScript: アロー関数 (引数) => 戻り値 の記法
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'プライベートサブネットのID一覧',
    });

    new cdk.CfnOutput(this, 'WebSecurityGroupId', {
      value: webSecurityGroup.securityGroupId,
      description: 'Web層セキュリティグループID',
      exportName: 'WebSecurityGroupId',       // 他のスタックから参照可能な名前
    });
    
    // TypeScript学習ポイント（このファイル）:
    // - public readonly: 他のクラスから読み取り専用でアクセス可能
    // - 配列: [] で表現、要素は [要素1, 要素2, 要素3]
    // - オブジェクトの配列: [{key: value}, {key: value}]
    // - メソッドチェーン: 配列.map().join() のような連続実行
    // - アロー関数: (引数) => 戻り値 の記法
    // - ネストしたオブジェクト: { outer: { inner: value } }
  }
}