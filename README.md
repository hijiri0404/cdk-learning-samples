# AWS CDK 学習用サンプルプロジェクト

このプロジェクトは、AWS CDK（Cloud Development Kit）を初心者から上級者まで段階的に学習できる包括的なサンプル集です。TypeScriptとAWSの基本から実践的なエンタープライズアプリケーション構築まで、体系的に学習できます。

## 🎯 プロジェクト構成

### 📚 基礎学習用スタック (lib/)
CDKの基本概念とTypeScriptの基礎を学ぶための4つのスタック：

- **S3Stack**: 基本的なリソース作成とCDKの基礎
- **LambdaStack**: サーバーレス関数とイベント処理
- **VpcStack**: ネットワーク設計と3層アーキテクチャ
- **ApiGatewayStack**: API作成とサービス統合

### 🚀 実践学習用サンプル (samples/)
レベル別に構成された10個の実践的なサンプルアプリケーション：

#### 🌱 レベル1: 基礎編 (samples/01-03)
- **01-hello-world-website**: S3 + CloudFront静的サイト
- **02-simple-api-server**: Lambda + API Gateway + DynamoDB
- **03-file-upload-system**: S3イベント + Lambda処理

#### 🌿 レベル2: 応用編 (samples/04-06)
- **04-blog-backend**: RDS PostgreSQL + VPC + セキュリティ
- **05-image-resize**: 画像処理 + Lambda Layers + SQS
- **06-monitoring**: CloudWatch + SNS + カスタムメトリクス

#### 🌳 レベル3: 実践編 (samples/07-10)
- **07-multi-environment**: 環境別設定管理 + GitOps
- **08-fullstack-todo**: React + Cognito + フルスタック
- **09-cicd-pipeline**: CodePipeline + 自動テスト + Docker
- **10-enterprise-security**: WAF + VPC + ゼロトラスト

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

## 🎯 学習ガイド

### 📚 推奨学習パス

#### 1️⃣ 基礎習得 (lib/)
まずは基本スタックでCDKの基礎を学習：
```bash
# 基本概念の習得
cdk deploy S3Stack      # リソース作成の基本
cdk deploy LambdaStack  # サーバーレス関数
cdk deploy VpcStack     # ネットワーク設計
cdk deploy ApiGatewayStack # API作成
```

#### 2️⃣ 実践学習 (samples/)
レベル別に段階的にスキルアップ：

**🌱 レベル1: 基礎編 (必須)**
- `samples/01-hello-world-website`: CDK + TypeScript基礎
- `samples/02-simple-api-server`: サーバーレス API
- `samples/03-file-upload-system`: イベント駆動処理

**🌿 レベル2: 応用編 (推奨)**
- `samples/04-blog-backend`: データベース連携
- `samples/05-image-resize`: 高度なファイル処理
- `samples/06-monitoring`: 運用・監視の実践

**🌳 レベル3: 実践編 (上級者向け)**
- `samples/07-multi-environment`: 環境管理
- `samples/08-fullstack-todo`: フルスタック開発
- `samples/09-cicd-pipeline`: DevOps実践
- `samples/10-enterprise-security`: エンタープライズ対応

### 💡 学習のコツ

- **1行ごとのコメントを活用**: TypeScriptとAWSの学習ポイントが明記
- **段階的デプロイ**: 各サンプルで実際にリソースを作成・確認・削除
- **コスト管理**: 各サンプルのコスト見積もりを事前確認
- **カスタマイズ実践**: 理解度確認のため設定変更に挑戦

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