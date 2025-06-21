# 🎯 初心者向け実践的サンプル10選

## 📋 学習レベル別構成

### 🌱 レベル1: 基礎編（CDK入門）
**対象**: CDK完全初心者、TypeScript基礎学習済み

1. **Sample01: Hello World Static Website**
   - S3 + CloudFront で静的サイト配信
   - 最もシンプルな構成で成功体験を得る
   - コスト: ほぼ0円

2. **Sample02: Simple API Server**
   - Lambda + API Gateway でシンプルなREST API
   - GET/POST エンドポイント
   - コスト: 無料枠内

3. **Sample03: File Upload System**
   - S3 + Lambda でファイルアップロード処理
   - 実用的かつ理解しやすい
   - コスト: 無料枠内

### 🌿 レベル2: 応用編（実用的構成）
**対象**: 基礎編完了者、AWS基本サービス理解済み

4. **Sample04: Blog Backend System**
   - API Gateway + Lambda + DynamoDB
   - CRUD操作の完全実装
   - コスト: 月$1-5程度

5. **Sample05: Image Resize Service**
   - S3 イベント + Lambda で画像リサイズ
   - 実際のビジネス要求に対応
   - コスト: 無料枠内

6. **Sample06: Monitoring Dashboard**
   - CloudWatch + SNS でアラート
   - 運用面の学習
   - コスト: 月$1程度

### 🌳 レベル3: 実践編（本格運用）
**対象**: 応用編完了者、本格的なアプリケーション構築希望

7. **Sample07: Multi-Environment Setup**
   - dev/staging/prod環境の構築
   - 環境別設定管理
   - コスト: 月$10-20程度

8. **Sample08: Full-Stack Todo App**
   - React + API Gateway + Lambda + DynamoDB
   - フロントエンド〜バックエンド一式
   - コスト: 月$5-15程度

9. **Sample09: CI/CD Pipeline**
   - CodePipeline + CodeBuild でデプロイ自動化
   - 本格的なDevOps実践
   - コスト: 月$10程度

10. **Sample10: Enterprise Security Setup**
    - WAF + VPC + セキュリティ設定
    - エンタープライズ級のセキュリティ
    - コスト: 月$20-50程度

## 🎨 各サンプルの特徴

### 📝 共通仕様
- 詳細なコメント（日本語）
- ステップバイステップのREADME
- デプロイ〜削除まで完全手順
- コスト見積もり明記
- トラブルシューティングガイド

### 🔧 技術的配慮
- TypeScript初心者でも理解できるコード
- 段階的な難易度上昇
- 実際のビジネス要求を反映
- セキュリティベストプラクティス
- コスト最適化

### 📚 学習効果
- 各サンプルで新しいAWSサービスを学習
- CDKの機能を段階的にマスター
- 実用的なアーキテクチャパターンを習得
- DevOpsプラクティスの理解

## 🗂️ ディレクトリ構造
```
samples/
├── 01-hello-world-website/
│   ├── README.md
│   ├── lib/
│   │   └── hello-world-stack.ts
│   └── assets/
│       ├── index.html
│       └── style.css
├── 02-simple-api-server/
│   ├── README.md
│   ├── lib/
│   │   └── api-server-stack.ts
│   └── lambda/
│       └── api-handler.py
└── ...
```

各サンプルは独立して動作し、順番に学習できる構成とします。