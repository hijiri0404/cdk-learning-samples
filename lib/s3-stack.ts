// TypeScript: 必要なライブラリをimportで読み込み
import * as cdk from 'aws-cdk-lib';        // AWS CDKのメインライブラリ
import * as s3 from 'aws-cdk-lib/aws-s3';  // S3サービス専用のライブラリ
import { Construct } from 'constructs';     // CDKのコンストラクト（部品）の基本クラス

// TypeScript: exportは他のファイルでこのクラスを使えるようにする
// classはオブジェクト指向プログラミングの設計図
// extendsは親クラス（cdk.Stack）の機能を継承する
export class S3Stack extends cdk.Stack {
  
  // TypeScript: constructorはクラスが作られる時に最初に実行される特別な関数
  // scope: このスタックの親となるコンストラクト
  // id: スタックの識別名（文字列型）
  // props?: cdk.StackProps (?マークは「任意」を意味し、渡さなくても良い)
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // super()は親クラスのコンストラクタを呼び出す
    super(scope, id, props);

    // 基本的なS3バケット
    // TypeScript: constで定数を宣言、new s3.Bucket()でS3バケットを作成
    // thisは現在のクラス（S3Stack）を指す
    // バッククォート`を使った文字列はテンプレートリテラルと呼び、${変数}で値を埋め込める
    const basicBucket = new s3.Bucket(this, 'BasicBucket', {
      bucketName: `basic-bucket-${this.account}-${this.region}`, // アカウントIDとリージョンを含む一意な名前
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にバケットも削除（学習用設定）
    });

    // 静的ウェブサイトホスティング用のバケット
    // TypeScript: オブジェクトの設定項目をプロパティと呼ぶ
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `website-bucket-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',     // ウェブサイトのメインページファイル名
      websiteErrorDocument: 'error.html',     // エラーページのファイル名
      publicReadAccess: true,                 // 一般公開を許可（ウェブサイト用）
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, // ACLのみブロック（バケットポリシーは許可）
    });

    // バージョニング有効なバケット
    const versionedBucket = new s3.Bucket(this, 'VersionedBucket', {
      bucketName: `versioned-bucket-${this.account}-${this.region}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 暗号化されたバケット
    const encryptedBucket = new s3.Bucket(this, 'EncryptedBucket', {
      bucketName: `encrypted-bucket-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ライフサイクルポリシー付きバケット
    const lifecycleBucket = new s3.Bucket(this, 'LifecycleBucket', {
      bucketName: `lifecycle-bucket-${this.account}-${this.region}`,
      lifecycleRules: [
        {
          id: 'DeleteOldObjects',
          enabled: true,
          expiration: cdk.Duration.days(30),
        },
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 出力（CloudFormationの出力値）
    // TypeScript: CfnOutputはAWSコンソールやCLIで確認できる出力値を定義
    new cdk.CfnOutput(this, 'BasicBucketName', {
      value: basicBucket.bucketName,        // 出力する値（バケット名）
      description: '基本的なS3バケット名',   // 出力の説明文
    });

    new cdk.CfnOutput(this, 'WebsiteBucketUrl', {
      value: websiteBucket.bucketWebsiteUrl, // ウェブサイトのURL
      description: '静的ウェブサイトのURL',
    });

    new cdk.CfnOutput(this, 'VersionedBucketArn', {
      value: versionedBucket.bucketArn,      // ARN（Amazon Resource Name）
      description: 'バージョニング有効バケットのARN',
    });
    
    // TypeScript用語まとめ（この部分）:
    // - const: 定数宣言
    // - new: インスタンス作成
    // - this: 現在のクラスを参照
    // - テンプレートリテラル: `文字列${変数}`
    // - オブジェクトリテラル: { key: value }
    // - プロパティ: オブジェクトの設定項目
  }
}