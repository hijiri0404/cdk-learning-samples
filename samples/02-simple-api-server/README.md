# 🚀 Sample 02: Simple API Server

## 📖 概要

CDK初心者向けの第2弾サンプルです。Lambda、API Gateway、DynamoDBを使ってシンプルなREST APIサーバーを構築します。

### 🎯 学習目標
- Lambda関数（サーバーレス）の基本を理解する
- API Gateway（REST API）の設定方法を学ぶ
- DynamoDB（NoSQL）の基本操作を習得する
- RESTful API設計の基礎を理解する
- PythonによるAPIロジック実装を学ぶ
- TypeScriptでのAWSリソース連携を体験する

### 🏗️ アーキテクチャ

```
Internet
    ↓
🌐 API Gateway (REST API)
    ↓
⚡ Lambda Function (Python)
    ↓
🗄️ DynamoDB Table
```

## 💰 コスト見積もり

**月間利用料金（概算）**
- Lambda実行: ~$0.20/月（100万リクエスト）
- API Gateway: ~$3.50/月（100万リクエスト）
- DynamoDB: ~$1.25/月（25GB書き込み、25GB読み込み）
- **合計: ~$5/月**（無料枠利用時は$0）

## 📋 API仕様

### 🔗 エンドポイント一覧

| メソッド | パス | 説明 | リクエストボディ |
|---------|------|------|----------------|
| GET | `/health` | ヘルスチェック | - |
| GET | `/items` | 全アイテム取得 | - |
| GET | `/items/{id}` | 特定アイテム取得 | - |
| POST | `/items` | アイテム作成 | JSON |
| PUT | `/items/{id}` | アイテム更新 | JSON |
| DELETE | `/items/{id}` | アイテム削除 | - |

### 📝 データ構造

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "サンプルアイテム",
  "description": "アイテムの説明",
  "category": "general",
  "status": "active",
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}
```

## 🚀 デプロイ手順

### 1. 前提条件
- AWS CLIが設定済み
- Node.js 18以上がインストール済み
- Sample 01が理解済み（推奨）

### 2. 依存関係の確認
```bash
# プロジェクトルートで実行
npm install
```

### 3. CDKアプリファイルの更新

`bin/cdk-learning-samples.ts` ファイルに以下を追加：

```typescript
import { ApiServerStack } from '../samples/02-simple-api-server/lib/api-server-stack';

// 既存のコードの後に追加
const apiServerStack = new ApiServerStack(app, 'ApiServerStack', {
  environment: 'dev',
  apiName: 'my-first-api',
  enableCors: true
});
```

### 4. TypeScriptコンパイル
```bash
npm run build
```

### 5. CloudFormationテンプレート生成（確認用）
```bash
cdk synth ApiServerStack
```

### 6. デプロイ実行
```bash
cdk deploy ApiServerStack
```

### 7. デプロイ完了確認

デプロイが完了すると、以下の出力が表示されます：

```
ApiServerStack.ApiUrl = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/
ApiServerStack.ItemsEndpoint = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/items
ApiServerStack.HealthEndpoint = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/health
```

## 🧪 API テスト方法

### 1. ヘルスチェック
```bash
curl https://your-api-url/health
```

### 2. アイテム作成
```bash
curl -X POST https://your-api-url/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "初回テストアイテム",
    "description": "CDKで作成したAPIのテスト",
    "category": "test"
  }'
```

### 3. 全アイテム取得
```bash
curl https://your-api-url/items
```

### 4. 特定アイテム取得
```bash
curl https://your-api-url/items/{item-id}
```

### 5. アイテム更新
```bash
curl -X PUT https://your-api-url/items/{item-id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "更新されたアイテム",
    "description": "アイテムを更新しました"
  }'
```

### 6. アイテム削除
```bash
curl -X DELETE https://your-api-url/items/{item-id}
```

## 📋 ファイル構成

```
02-simple-api-server/
├── README.md                    # このファイル
├── lib/
│   └── api-server-stack.ts     # CDKスタック定義（TypeScript）
└── lambda/
    └── api_handler.py          # Lambda関数（Python）
```

## 🔍 TypeScript学習ポイント

### 1. インターフェース拡張
```typescript
// 既存の型を拡張して新しい設定型を作成
interface ApiServerStackProps extends cdk.StackProps {
  environment?: string;
  apiName?: string;
  enableCors?: boolean;
}
```

### 2. デフォルト値とOR演算子
```typescript
// undefinedの場合にデフォルト値を使用
const environment = props.environment || 'dev';
const enableCors = props.enableCors !== false; // デフォルトはtrue
```

### 3. 条件分岐演算子（三項演算子）
```typescript
// 条件に応じて異なる値を設定
defaultCorsPreflightOptions: enableCors ? {
  allowOrigins: apigateway.Cors.ALL_ORIGINS,
} : undefined
```

### 4. オブジェクトのメソッドチェーン
```typescript
// オブジェクトのメソッドを連続呼び出し
const itemsResource = api.root.addResource('items');
itemsResource.addMethod('GET', lambdaIntegration);
```

## 🐍 Python学習ポイント

### 1. 型ヒント
```python
# 関数の引数と戻り値の型を明示
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    pass
```

### 2. 辞書操作
```python
# 安全な値取得（存在しない場合はデフォルト値）
http_method = event.get('httpMethod', 'GET')
body = event.get('body')
```

### 3. 例外処理
```python
try:
    # 実行したい処理
    result = some_operation()
except Exception as e:
    # エラーが発生した場合の処理
    print(f"Error: {str(e)}")
```

### 4. リスト内包表記
```python
# 効率的なリスト作成
items = [format_item(item) for item in response['Items']]
```

## 🛠️ カスタマイズ例

### 1. API名の変更
```typescript
const apiServerStack = new ApiServerStack(app, 'ApiServerStack', {
  apiName: 'my-todo-api',  // ← ここを変更
  environment: 'dev'
});
```

### 2. 新しいエンドポイントの追加

`api-server-stack.ts` に追加：
```typescript
// /users エンドポイント
const usersResource = rootResource.addResource('users');
usersResource.addMethod('GET', lambdaIntegration);
```

`api_handler.py` に追加：
```python
elif path == '/users':
    if http_method == 'GET':
        return get_all_users()
```

### 3. バリデーション追加

`api_handler.py` のcreate_item関数に：
```python
# 必須フィールドのチェック
if not body.get('name'):
    return create_response(400, {'error': 'Name is required'})
```

## 🧹 削除手順

**重要**: 学習が完了したら必ずリソースを削除してください

```bash
cdk destroy ApiServerStack
```

## ❗ トラブルシューティング

### 1. Lambda関数のデプロイエラー
**エラー**: Python dependencies not found
**解決**: 
```bash
# lambda/ディレクトリでrequirements.txtがある場合
cd samples/02-simple-api-server/lambda
pip install -r requirements.txt -t .
```

### 2. DynamoDB権限エラー
**エラー**: AccessDeniedException
**確認点**: 
- CDKでIAM権限が正しく設定されているか
- `itemsTable.grantReadWriteData(apiHandler)` が実行されているか

### 3. API Gatewayの504エラー
**原因**: Lambda関数のタイムアウト
**解決**: timeout値を調整
```typescript
timeout: cdk.Duration.seconds(30),  // 30秒に延長
```

### 4. CORS エラー
**症状**: ブラウザからのリクエストが失敗
**確認**: 
- enableCors: true が設定されているか
- Lambda関数でCORSヘッダーが返されているか

## 🔧 デバッグ方法

### 1. Lambda関数のログ確認
```bash
# AWS CLIでログを確認
aws logs describe-log-groups --log-group-name-prefix '/aws/lambda/ApiServerStack'
aws logs tail '/aws/lambda/ApiServerStack-ApiHandler' --follow
```

### 2. DynamoDBテーブルの確認
```bash
# テーブル内容の確認
aws dynamodb scan --table-name your-table-name
```

### 3. API Gatewayのテスト
AWSコンソール → API Gateway → テスト機能を使用

## 📚 次のステップ

1. ✅ Sample 02 完了
2. 📊 DynamoDBコンソールでデータを確認
3. 🔧 Lambdaのログを確認してデバッグを体験
4. 🎨 新しいエンドポイントを追加してみる
5. 🚀 Sample 03（File Upload System）に挑戦

## 🔗 参考リンク

- [AWS Lambda Python](https://docs.aws.amazon.com/lambda/latest/dg/python-programming-model.html)
- [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Amazon DynamoDB](https://docs.aws.amazon.com/dynamodb/)
- [Python boto3 DynamoDB](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/dynamodb.html)

---

**🎉 おめでとうございます！** 
本格的なAPI サーバーが完成しました。RESTful APIとサーバーレスアーキテクチャの基礎を理解できたはずです。