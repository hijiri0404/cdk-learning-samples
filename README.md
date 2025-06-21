# AWS CDK 学習用サンプルプロジェクト

このプロジェクトは、AWS CDK（Cloud Development Kit）を学習するためのサンプルコードです。TypeScriptで書かれており、基本的なAWSリソースの作成方法を学べます。

## 📋 含まれるスタック

### 1. S3Stack (lib/s3-stack.ts)
- 基本的なS3バケット
- 静的ウェブサイトホスティング用バケット
- バージョニング有効なバケット
- 暗号化されたバケット
- ライフサイクルポリシー付きバケット

### 2. LambdaStack (lib/lambda-stack.ts)
- Python Lambda関数
- Node.js Lambda関数
- 定期実行Lambda関数（CloudWatch Events）
- IAMロールと権限の設定

### 3. VpcStack (lib/vpc-stack.ts)
- VPC（Virtual Private Cloud）
- パブリック・プライベート・分離サブネット
- セキュリティグループ（3層アーキテクチャ用）
- VPCエンドポイント（S3, DynamoDB）
- NATゲートウェイ

### 4. ApiGatewayStack (lib/api-gateway-stack.ts)
- REST API Gateway
- Lambda統合
- モック統合
- API Key と Usage Plan
- CORS設定

## 🚀 セットアップ

### 前提条件
- Node.js (v18以上)
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)

### インストール
```bash
cd cdk-learning-samples
npm install
```

### 初期化（初回のみ）
```bash
# AWSアカウントでCDKを初期化
cdk bootstrap
```

## 📖 使用方法

### 1. プロジェクトのビルド
```bash
npm run build
```

### 2. CDKテンプレートの確認
```bash
# 全てのスタックを確認
npm run synth

# 特定のスタックのみ確認
cdk synth S3Stack
```

### 3. 差分確認
```bash
# 全てのスタックの差分を確認
npm run diff

# 特定のスタックの差分を確認
cdk diff S3Stack
```

### 4. デプロイ
```bash
# 全てのスタックをデプロイ
npm run deploy

# 特定のスタックのみデプロイ
cdk deploy S3Stack

# 複数のスタックを指定
cdk deploy S3Stack LambdaStack
```

### 5. リソースの削除
```bash
# 全てのスタックを削除
npm run destroy

# 特定のスタックのみ削除
cdk destroy S3Stack
```

## 🎯 学習ポイント

### 基本概念
- **App**: CDKアプリケーションのルート
- **Stack**: AWSリソースの論理的なグループ
- **Construct**: 再利用可能なクラウドコンポーネント

### CDKの特徴
- **Infrastructure as Code**: インフラをコードで管理
- **型安全性**: TypeScriptによる型チェック
- **再利用性**: コンストラクトライブラリの活用
- **テスト可能**: ユニットテストの実装

### スタック間の依存関係
```typescript
// 他のスタックからVPCを参照する例
import { VpcStack } from './vpc-stack';

const vpcStack = new VpcStack(app, 'VpcStack');
const appStack = new AppStack(app, 'AppStack', {
  vpc: vpcStack.vpc  // VPCを他のスタックで使用
});
```

## 🔧 カスタマイズ方法

### 環境変数の設定
```typescript
// bin/app.ts
new S3Stack(app, 'S3Stack-Dev', {
  env: {
    account: '123456789012',
    region: 'ap-northeast-1',
  },
});
```

### リソース名のカスタマイズ
```typescript
// 環境ごとに異なるリソース名
const bucketName = `my-app-${process.env.NODE_ENV}-bucket`;
```

## 📚 学習リソース

### 公式ドキュメント
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [AWS CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)

### 実践的な学習順序
1. **S3Stack**: 基本的なリソース作成
2. **LambdaStack**: サーバーレス関数の作成
3. **VpcStack**: ネットワーク設計
4. **ApiGatewayStack**: API作成とサービス統合

## ⚠️ 注意事項

- このプロジェクトは学習用です。本番環境での使用前に適切なセキュリティ設定を行ってください
- AWSリソースの作成には料金が発生する場合があります
- 不要なリソースは `cdk destroy` で削除してください
- `RemovalPolicy.DESTROY` により、スタック削除時にデータも削除されます

## 🤝 次のステップ

1. 既存のスタックを修正してみる
2. 新しいリソース（RDS, ElastiCache等）を追加
3. スタック間の依存関係を実装
4. テストコードを作成
5. CI/CDパイプラインの構築

Happy learning! 🎉