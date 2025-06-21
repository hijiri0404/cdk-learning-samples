# 🎯 CDK初心者向け実践サンプル集

TypeScript未学習者からCDK上級者まで段階的に学習できる10個のサンプル集です。

## 📚 学習レベル別構成

### 🌱 レベル1: 基礎編（CDK入門）
**対象**: CDK完全初心者、TypeScript基礎学習済み

| サンプル | 内容 | 学習目標 | コスト/月 |
|---------|------|---------|----------|
| **01** Hello World Website | S3 + CloudFront静的サイト | CDKの基本、TypeScript実践 | ~$0 |
| **02** Simple API Server | Lambda + API Gateway + DynamoDB | RESTful API、サーバーレス | ~$5 |
| **03** File Upload System | S3イベント + Lambda処理 | ファイル処理、イベント駆動 | ~$3 |

### 🌿 レベル2: 応用編（実用的構成）
**対象**: 基礎編完了者、AWS基本サービス理解済み

| サンプル | 内容 | 学習目標 | コスト/月 |
|---------|------|---------|----------|
| **04** Blog Backend System | API Gateway + Lambda + RDS | データベース連携、CRUD | ~$15 |
| **05** Image Resize Service | S3 + Lambda + CloudFront | 画像処理、CDN最適化 | ~$8 |
| **06** Monitoring Dashboard | CloudWatch + SNS + Lambda | 監視・アラート、運用面 | ~$5 |

### 🌳 レベル3: 実践編（本格運用）
**対象**: 応用編完了者、本格的なアプリケーション構築希望

| サンプル | 内容 | 学習目標 | コスト/月 |
|---------|------|---------|----------|
| **07** Multi-Environment | dev/staging/prod環境構築 | 環境分離、設定管理 | ~$20 |
| **08** Full-Stack Todo App | React + API + DB 一式 | フルスタック開発 | ~$15 |
| **09** CI/CD Pipeline | CodePipeline + CodeBuild | DevOps、自動デプロイ | ~$10 |
| **10** Enterprise Security | WAF + VPC + セキュリティ | エンタープライズ対応 | ~$50 |

## 🚀 学習の進め方

### ステップ1: 準備
1. [TypeScript基礎実例集](../docs/cdk-stack-guide.md#typescript基礎実例集cdk学習準備) で基礎学習
2. AWS CLI設定とCDK環境構築
3. Sample 01から順番に実施

### ステップ2: 基礎編（必須）
- **Sample 01-03** を順番に完了
- 各サンプルでデプロイ → 動作確認 → 削除を実施
- コメントを読んでTypeScript/AWS概念を理解

### ステップ3: 応用編（推奨）
- **Sample 04-06** で実用的なアプリケーション構築
- 複数AWSサービスの連携を学習
- 運用・監視の基礎を習得

### ステップ4: 実践編（上級者向け）
- **Sample 07-10** で本格的なシステム構築
- エンタープライズ級の設計パターン習得
- 実際の業務で使用できるレベルに到達

## 🛠️ 共通仕様

### 📝 全サンプル共通
- **詳細な日本語コメント**: TypeScript初心者でも理解可能
- **ステップバイステップ手順**: デプロイから削除まで完全ガイド
- **コスト見積もり**: 学習コストを事前に把握
- **トラブルシューティング**: よくあるエラーと対処法
- **カスタマイズ例**: 応用・発展のヒント

### 🔧 技術的配慮
- **段階的難易度**: 無理なくスキルアップ
- **セキュリティ重視**: ベストプラクティス準拠
- **コスト最適化**: 学習用設定でコスト削減
- **実用性重視**: ビジネス要求を反映した構成

## 📋 各サンプルの詳細

### Sample 01: Hello World Website ✅
**完成度**: 100% | **難易度**: ⭐☆☆☆☆
- S3静的ウェブサイトホスティング
- CloudFront CDN配信
- TypeScriptクラス継承の基礎

### Sample 02: Simple API Server ✅
**完成度**: 100% | **難易度**: ⭐⭐☆☆☆
- Lambda関数によるAPI実装
- DynamoDB NoSQLデータベース
- RESTful API設計の基礎

### Sample 03: File Upload System ✅
**完成度**: 100% | **難易度**: ⭐⭐⭐☆☆
- S3イベント駆動処理
- 署名付きURLでセキュアアップロード
- ファイル処理の実践

### Sample 04: Blog Backend System 🚧
**完成度**: 80% | **難易度**: ⭐⭐⭐☆☆
- RDS PostgreSQL データベース
- VPC ネットワーク構成
- 本格的なCRUD API

### Sample 05: Image Resize Service 🚧
**完成度**: 70% | **難易度**: ⭐⭐⭐☆☆
- 画像リサイズ処理
- 複数サイズ自動生成
- パフォーマンス最適化

### Sample 06: Monitoring Dashboard 🚧
**完成度**: 60% | **難易度**: ⭐⭐⭐⭐☆
- CloudWatch メトリクス収集
- SNS アラート通知
- 運用監視の実践

### Sample 07: Multi-Environment Setup 📋
**完成度**: 30% | **難易度**: ⭐⭐⭐⭐☆
- 環境別設定管理
- パラメータストア連携
- GitOps ワークフロー

### Sample 08: Full-Stack Todo App 📋
**完成度**: 20% | **難易度**: ⭐⭐⭐⭐⭐
- React フロントエンド
- 認証・認可システム
- フルスタック開発

### Sample 09: CI/CD Pipeline 📋
**完成度**: 10% | **難易度**: ⭐⭐⭐⭐⭐
- GitHub Actions連携
- 自動テスト・デプロイ
- DevOps プラクティス

### Sample 10: Enterprise Security 📋
**完成度**: 5% | **難易度**: ⭐⭐⭐⭐⭐
- WAF セキュリティ
- VPC エンドポイント
- ゼロトラスト・アーキテクチャ

## 🔄 継続的改善

このサンプル集は継続的に改善・更新されます：

- **フィードバック反映**: 学習者の声を収集して改善
- **新サービス対応**: AWSの新サービスに対応
- **難易度調整**: より学習しやすい構成に改善
- **実用例追加**: 実際のビジネス要求に対応

## 🤝 コントリビューション

改善提案や新サンプルのアイデアを歓迎します：

1. Issue で問題や改善案を報告
2. Pull Request で具体的な改善を提案
3. Discussion で学習体験を共有

---

**🎯 目標**: このサンプル集を通じて、TypeScript初心者からAWS CDKエキスパートまで成長できることを目指しています。