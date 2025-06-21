# 🌐 Sample 01: Hello World Static Website

## 📖 概要

CDK初心者向けの最初のサンプルです。S3とCloudFrontを使って静的ウェブサイトを作成し、世界中に配信します。

### 🎯 学習目標
- CDKの基本的な使い方を理解する
- TypeScriptの基本構文を実践的に学ぶ
- S3静的ウェブサイトホスティングを理解する
- CloudFront（CDN）の基礎を学ぶ
- インフラストラクチャ・アズ・コード（IaC）を体験する

### 🏗️ アーキテクチャ

```
Internet
    ↓
🌐 CloudFront (CDN)
    ↓
📦 S3 Bucket (Static Website)
    ↓
📄 HTML/CSS/JS files
```

## 💰 コスト見積もり

**月間利用料金（概算）**
- S3 ストレージ: ~$0.02/月（1GB未満）
- CloudFront 転送量: ~$0.085/月（初回10TBは無料枠）
- **合計: ほぼ$0/月**（AWS無料枠内）

## 🚀 デプロイ手順

### 1. 前提条件
- AWS CLIが設定済み
- Node.js 18以上がインストール済み
- CDKプロジェクトのルートディレクトリにいること

### 2. 依存関係の確認
```bash
# プロジェクトルートで実行
npm install
```

### 3. CDKアプリファイルの更新

`bin/cdk-learning-samples.ts` ファイルに以下を追加：

```typescript
import { HelloWorldStack } from '../samples/01-hello-world-website/lib/hello-world-stack';

// 既存のコードの後に追加
const helloWorldStack = new HelloWorldStack(app, 'HelloWorldStack', {
  websiteName: 'my-first-site',
  environment: 'dev'
});
```

### 4. TypeScriptコンパイル
```bash
npm run build
```

### 5. CloudFormationテンプレート生成（確認用）
```bash
cdk synth HelloWorldStack
```

### 6. デプロイ実行
```bash
cdk deploy HelloWorldStack
```

### 7. デプロイ完了確認

デプロイが完了すると、以下の出力が表示されます：

```
HelloWorldStack.WebsiteURL = https://d1234567890.cloudfront.net
HelloWorldStack.S3BucketName = my-first-site-dev-123456789012
HelloWorldStack.CloudFrontDistributionId = E1234567890ABC
```

ブラウザで `WebsiteURL` にアクセスしてウェブサイトを確認してください。

## 📋 ファイル構成

```
01-hello-world-website/
├── README.md                    # このファイル
├── lib/
│   └── hello-world-stack.ts    # CDKスタック定義（TypeScript）
└── assets/                     # ウェブサイトファイル
    ├── index.html              # メインページ
    ├── style.css               # スタイルシート
    └── error.html              # エラーページ
```

## 🔍 TypeScript学習ポイント

### 1. import文とモジュール
```typescript
// ライブラリ全体を名前空間として取り込み
import * as cdk from 'aws-cdk-lib';

// 特定のクラスのみを取り込み
import { Construct } from 'constructs';
```

### 2. interface（インターフェース）
```typescript
// 設定情報の型を定義
interface HelloWorldStackProps extends cdk.StackProps {
  websiteName?: string;  // ? = 省略可能
  environment?: string;
}
```

### 3. class（クラス）とextends（継承）
```typescript
// cdk.Stackクラスを継承した新しいクラス
export class HelloWorldStack extends cdk.Stack {
  // プロパティ定義
  public readonly websiteUrl: string;
}
```

### 4. constructor（コンストラクタ）
```typescript
constructor(scope: Construct, id: string, props: HelloWorldStackProps = {}) {
  super(scope, id, props);  // 親クラスの初期化
  // 初期化処理
}
```

### 5. テンプレートリテラル
```typescript
// バッククォートで変数を文字列に埋め込み
const bucketName = `${siteName}-${env}-${this.account}`;
```

## 🛠️ カスタマイズ例

### 1. ウェブサイト名の変更
```typescript
const helloWorldStack = new HelloWorldStack(app, 'HelloWorldStack', {
  websiteName: 'my-awesome-site',  // ← ここを変更
  environment: 'dev'
});
```

### 2. HTMLコンテンツの編集
`assets/index.html` を編集してオリジナルコンテンツを追加

### 3. スタイルのカスタマイズ
`assets/style.css` を編集してデザインを変更

## 🧹 削除手順

**重要**: 学習が完了したら必ずリソースを削除してください

```bash
cdk destroy HelloWorldStack
```

確認メッセージで `y` を入力して削除を確定します。

## ❗ トラブルシューティング

### 1. デプロイエラー: バケット名重複
**エラー**: BucketAlreadyExists
**解決**: `websiteName` を別の名前に変更

### 2. CloudFrontのデプロイ時間
**症状**: CloudFrontの作成に15-20分かかる
**対処**: 正常な動作です。気長に待ちましょう

### 3. ウェブサイトが表示されない
**確認点**:
1. CloudFrontのデプロイが完了しているか
2. S3バケットにファイルがアップロードされているか
3. CloudFrontのURLが正しいか

### 4. TypeScriptコンパイルエラー
```bash
# 型チェックとコンパイル
npm run build

# 詳細エラー確認
npx tsc --noEmit
```

## 📚 次のステップ

1. ✅ Sample 01 完了
2. 📖 `hello-world-stack.ts` のコメントを読み返してTypeScriptを復習
3. 🎨 HTML/CSSを編集してオリジナルサイトを作成
4. 🚀 Sample 02（Simple API Server）に挑戦

## 🔗 参考リンク

- [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Amazon S3 静的ウェブサイトホスティング](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [Amazon CloudFront](https://docs.aws.amazon.com/cloudfront/)

---

**🎉 おめでとうございます！** 
あなたの最初のCDKプロジェクトが完成しました。この成功体験を糧に、次のサンプルにも挑戦してください！