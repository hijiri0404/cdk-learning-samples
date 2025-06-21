// 📚 TypeScript学習ポイント: import文
// import は他のファイルやライブラリから機能を取り込む命令
// * as cdk は「cdkライブラリの全ての機能を『cdk』という名前で使う」という意味
import * as cdk from 'aws-cdk-lib';
// { Construct } は「constructsライブラリからConstructクラスだけを取り込む」という意味
import { Construct } from 'constructs';
// S3（ストレージサービス）とCloudFront（CDN）のライブラリを取り込み
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

// 📚 TypeScript学習ポイント: interface（インターフェース）
// interfaceは「この形式でデータを渡してください」という設計図
// extendsは親の設計図を継承（引き継ぎ）して、新しい項目を追加する意味
interface HelloWorldStackProps extends cdk.StackProps {
  // string は文字列型、? は「省略可能」を意味
  websiteName?: string;  // ウェブサイト名（省略可能）
  environment?: string;  // 環境名（dev, prod等、省略可能）
}

// 📚 TypeScript学習ポイント: class（クラス）とextends（継承）
// export = 他のファイルでこのクラスを使えるようにする
// class = オブジェクト指向プログラミングの設計図
// extends = 親クラス（cdk.Stack）の機能を引き継ぐ
export class HelloWorldStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: プロパティ（クラスの変数）
  // public = 外部からアクセス可能
  // readonly = 一度設定したら変更不可
  public readonly websiteUrl: string;
  public readonly bucketName: string;

  // 📚 TypeScript学習ポイント: constructor（コンストラクタ）
  // クラスが作られる時に最初に実行される特別な関数
  // scope: このスタックの親（通常はApp）
  // id: スタックの識別名
  // props: 設定情報（上で定義したHelloWorldStackProps型）
  constructor(scope: Construct, id: string, props: HelloWorldStackProps = {}) {
    // 📚 TypeScript学習ポイント: super()
    // 親クラス（cdk.Stack）のコンストラクタを呼び出す
    // これを忘れるとエラーになる
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の設定
    // || 演算子は「左がundefined/nullなら右の値を使う」という意味
    const siteName = props.websiteName || 'my-first-website';
    const env = props.environment || 'dev';

    // 📚 TypeScript学習ポイント: テンプレートリテラル
    // バッククォート ` を使うと文字列内に ${変数} で値を埋め込める
    const bucketName = `${siteName}-${env}-${this.account}`;

    // 🏗️ AWS S3バケットの作成
    // 📚 TypeScript学習ポイント: オブジェクト作成
    // new = 新しいインスタンス（実体）を作る
    // this = 現在のクラス（HelloWorldStack）を指す
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      // 📚 TypeScript学習ポイント: オブジェクトリテラル
      // { キー: 値, キー: 値 } の形式で設定を指定
      bucketName: bucketName,
      
      // ウェブサイトホスティングの設定
      websiteIndexDocument: 'index.html',  // メインページのファイル名
      websiteErrorDocument: 'error.html',  // エラーページのファイル名
      
      // パブリックアクセスの設定
      publicReadAccess: true,              // 一般公開を許可
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,  // ACLのみブロック
      
      // 📚 AWS学習ポイント: リソース削除ポリシー
      // DESTROY = スタック削除時にバケットも削除（学習用設定）
      // 本番環境では RETAIN（残す）を使用することが多い
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      
      // バケット内のオブジェクトも自動削除（学習用設定）
      autoDeleteObjects: true,
    });

    // 🌐 CloudFront（CDN）の作成
    // CDN = Content Delivery Network（世界中にキャッシュして高速配信）
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      // デフォルトの動作設定
      defaultBehavior: {
        // 📚 TypeScript学習ポイント: クラスの静的メソッド呼び出し
        // origins.S3Origin.fromBucket() は「S3バケットをオリジンとして設定」
        origin: origins.S3Origin.fromBucket(websiteBucket),
        
        // キャッシュポリシー（どのくらいキャッシュするか）
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        
        // 許可するHTTPメソッド
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        
        // ビューワープロトコルポリシー（HTTPS推奨）
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      
      // デフォルトルートオブジェクト（ドメインルートでアクセスした時のファイル）
      defaultRootObject: 'index.html',
      
      // エラーページの設定
      errorResponses: [
        {
          httpStatus: 404,           // 404エラーの時
          responsePagePath: '/error.html',  // このページを表示
          responseHttpStatus: 404,   // HTTPステータスコードは404のまま
        },
      ],
      
      // コメント（説明文）
      comment: `${siteName} website distribution`,
    });

    // 📤 ウェブサイトファイルのデプロイ
    // assetsフォルダ内のファイルをS3バケットにアップロード
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      // アップロード元のフォルダ（ローカルのassetsフォルダ）
      sources: [s3deploy.Source.asset('./samples/01-hello-world-website/assets')],
      
      // アップロード先のS3バケット
      destinationBucket: websiteBucket,
      
      // CloudFrontのキャッシュを無効化（新しいファイルがすぐ反映される）
      distribution: distribution,
      distributionPaths: ['/*'],  // 全てのパスのキャッシュを無効化
    });

    // 📚 TypeScript学習ポイント: プロパティへの代入
    // this.プロパティ名 = 値 でクラスのプロパティに値を設定
    this.websiteUrl = distribution.distributionDomainName;
    this.bucketName = websiteBucket.bucketName;

    // 📤 出力値の定義（デプロイ後にCLIやコンソールで確認できる値）
    // 📚 TypeScript学習ポイント: オブジェクト作成（変数に代入しない場合）
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${distribution.distributionDomainName}`,  // CloudFrontのURL
      description: 'ウェブサイトのURL（CloudFront経由）',       // 説明文
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: websiteBucket.bucketName,
      description: 'ウェブサイトファイルが保存されているS3バケット名',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFrontディストリビューションID',
    });

    // 📚 TypeScript学習まとめ（このファイルで使用した概念）:
    // ✅ import文: 他のライブラリを取り込む
    // ✅ interface: データの形式を定義
    // ✅ class: オブジェクトの設計図
    // ✅ extends: 親クラスの機能を継承
    // ✅ constructor: クラス作成時の初期化関数
    // ✅ super(): 親クラスのコンストラクタ呼び出し
    // ✅ プロパティ: クラス内の変数
    // ✅ メソッド: クラス内の関数
    // ✅ テンプレートリテラル: `文字列${変数}`
    // ✅ オブジェクトリテラル: { キー: 値 }
    // ✅ 型注釈: 変数名: 型名
    // ✅ デフォルト値: 変数 = デフォルト値
  }
}