# 📁 Sample 03: File Upload System

## 📖 概要

CDK基礎編の第3弾サンプルです。S3イベント駆動処理、Lambda、API Gatewayを使ってセキュアなファイルアップロードシステムを構築します。

### 🎯 学習目標
- S3イベント駆動処理の理解
- 署名付きURLによるセキュアアップロード
- ファイル検証・処理の自動化
- Lambda関数間の連携
- 複数S3バケットの使い分け
- エラーハンドリングと隔離機能

### 🏗️ アーキテクチャ

```
Client
    ↓ (1) Upload URL Request
🌐 API Gateway
    ↓
⚡ API Lambda
    ↓ (2) Presigned URL
Client
    ↓ (3) File Upload
📦 Upload S3 Bucket
    ↓ (4) S3 Event
⚡ File Processor Lambda
    ↓ (5) Process & Move
📦 Processed S3 Bucket
```

## 💰 コスト見積もり

**月間利用料金（概算）**
- S3 ストレージ: ~$1/月（10GB）
- Lambda実行: ~$1/月（10万リクエスト）
- API Gateway: ~$1/月（10万リクエスト）
- データ転送: ~$0.5/月
- **合計: ~$3.5/月**（無料枠利用時は$0）

## 📋 システム機能

### 🔗 API エンドポイント

| メソッド | パス | 説明 | 機能 |
|---------|------|------|------|
| POST | `/upload` | アップロードURL取得 | 署名付きURL生成 |
| GET | `/files` | ファイル一覧 | アップロード済みファイル表示 |
| GET | `/files/{fileId}` | ファイル情報 | 詳細情報取得 |
| DELETE | `/files/{fileId}` | ファイル削除 | 完全削除 |
| GET | `/download/{fileId}` | ダウンロードURL | 署名付きダウンロードURL |
| GET | `/status/{fileId}` | 処理状況 | 処理ステータス確認 |

### 🔧 ファイル処理フロー

1. **アップロードリクエスト**: クライアントがAPI経由で署名付きURLを取得
2. **セキュアアップロード**: S3に直接ファイルをアップロード
3. **自動検証**: ファイルサイズ・形式・内容を自動検証
4. **処理実行**: 画像リサイズやメタデータ抽出等
5. **結果保存**: 処理済みファイルを別バケットに保存
6. **エラー処理**: 問題のあるファイルは隔離フォルダに移動

## 🚀 デプロイ手順

### 1. 前提条件
- AWS CLIが設定済み
- Node.js 18以上がインストール済み
- Sample 01-02が完了済み（推奨）

### 2. CDKアプリファイルの更新

`bin/cdk-learning-samples.ts` ファイルに以下を追加：

```typescript
import { FileUploadStack } from '../samples/03-file-upload-system/lib/file-upload-stack';

// 既存のコードの後に追加
const fileUploadStack = new FileUploadStack(app, 'FileUploadStack', {
  projectName: 'my-file-system',
  environment: 'dev',
  maxFileSizeMB: 10,
  allowedFileTypes: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx'],
  enableImageResize: true
});
```

### 3. デプロイ実行
```bash
npm run build
cdk deploy FileUploadStack
```

### 4. デプロイ完了確認

以下の出力を確認：

```
FileUploadStack.UploadApiUrl = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/
FileUploadStack.UploadEndpoint = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/upload
FileUploadStack.ProcessedBucketWebsiteUrl = http://my-file-system-processed-dev-123456789012.s3-website-ap-northeast-1.amazonaws.com
```

## 🧪 システムテスト

### 1. 署名付きURLの取得
```bash
curl -X POST https://your-api-url/upload \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-image.jpg",
    "content_type": "image/jpeg",
    "file_size": 1024000
  }'
```

### 2. ファイルアップロード
```bash
# 上記で取得したupload_urlを使用
curl -X PUT "https://presigned-url..." \
  -H "Content-Type: image/jpeg" \
  --data-binary @test-image.jpg
```

### 3. ファイル一覧確認
```bash
curl https://your-api-url/files
```

### 4. 処理状況確認
```bash
curl https://your-api-url/status/{fileId}
```

### 5. ダウンロードURL取得
```bash
curl https://your-api-url/download/{fileId}
```

## 📋 ファイル構成

```
03-file-upload-system/
├── README.md                     # このファイル
├── lib/
│   └── file-upload-stack.ts     # CDKスタック定義
├── lambda/
│   ├── api_handler.py           # API処理Lambda関数
│   └── file_processor.py        # ファイル処理Lambda関数
└── assets/
    └── upload-interface.html     # シンプルなアップロード画面
```

## 🔍 TypeScript学習ポイント

### 1. 複雑なインターフェース定義
```typescript
interface FileUploadStackProps extends cdk.StackProps {
  projectName?: string;
  maxFileSizeMB?: number;
  allowedFileTypes?: string[];  // 配列型
  enableVirusScan?: boolean;
}
```

### 2. 配列操作
```typescript
// 配列を文字列に変換
const allowedTypes = props.allowedFileTypes || ['.jpg', '.png'];
environment: {
  ALLOWED_FILE_TYPES: allowedTypes.join(',')  // "jpg,png"
}
```

### 3. S3イベント通知の設定
```typescript
// S3バケットにイベント通知を追加
uploadBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3notifications.LambdaDestination(fileProcessorFunction),
  { prefix: 'uploads/' }  // フィルター条件
);
```

### 4. IAM権限の詳細設定
```typescript
// 特定のアクションに対する詳細な権限設定
apiFunction.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['s3:PutObject', 's3:PutObjectAcl'],
  resources: [`${uploadBucket.bucketArn}/*`]
}));
```

## 🐍 Python学習ポイント

### 1. Lambda間の役割分担
```python
# api_handler.py - API処理専用
def lambda_handler(event, context):
    # API Gatewayからのリクエスト処理
    
# file_processor.py - ファイル処理専用  
def lambda_handler(event, context):
    # S3イベントからのファイル処理
```

### 2. S3署名付きURL生成
```python
# セキュアなファイルアップロード用URL生成
presigned_url = s3_client.generate_presigned_url(
    'put_object',
    Params={
        'Bucket': bucket_name,
        'Key': file_key,
        'ContentType': content_type
    },
    ExpiresIn=900  # 15分有効
)
```

### 3. S3イベント処理
```python
# S3イベントからファイル情報を抽出
def process_s3_event(record):
    bucket_name = record['s3']['bucket']['name']
    object_key = unquote_plus(record['s3']['object']['key'])
    event_name = record['eventName']
```

## 🛠️ カスタマイズ例

### 1. 許可ファイル形式の変更
```typescript
const fileUploadStack = new FileUploadStack(app, 'FileUploadStack', {
  allowedFileTypes: ['.mp4', '.mov', '.avi'],  // 動画ファイルのみ
  maxFileSizeMB: 100  // 大きなファイルサイズ
});
```

### 2. 画像リサイズ機能の追加

`file_processor.py` に追加：
```python
from PIL import Image

def resize_image(file_content):
    # PIL/Pillowを使った画像リサイズ
    image = Image.open(file_content)
    sizes = [(150, 150), (300, 300), (800, 600)]
    
    resized_images = {}
    for width, height in sizes:
        resized = image.resize((width, height), Image.LANCZOS)
        resized_images[f"{width}x{height}"] = resized
    
    return resized_images
```

### 3. ウイルススキャン機能
```python
# VirusTotalやClamAV連携でウイルススキャン
def scan_file_for_virus(file_content):
    # ウイルススキャンのロジック
    return {"is_safe": True, "scan_result": "clean"}
```

## 🧹 削除手順

**重要**: 学習完了後は必ずリソースを削除

```bash
cdk destroy FileUploadStack
```

## ❗ トラブルシューティング

### 1. Lambda権限エラー
**エラー**: AccessDenied
**確認点**:
- `grantReadWrite` が正しく設定されているか
- IAM PolicyStatementが適切か

### 2. CORS エラー
**症状**: ブラウザからのアップロードが失敗
**解決**: 
- API GatewayのCORS設定確認
- S3バケットのCORS設定確認

### 3. ファイル処理が実行されない
**確認点**:
- S3イベント通知が設定されているか
- Lambda関数のログを確認
- ファイルが正しいプレフィックス（uploads/）にアップロードされているか

### 4. 署名付きURLの期限切れ
**症状**: URL生成後すぐに期限切れ
**解決**: 
- システム時刻の確認
- ExpiresInの値を確認

## 📊 ログとモニタリング

### 1. CloudWatch Logs確認
```bash
# API Lambda関数のログ
aws logs tail '/aws/lambda/FileUploadStack-ApiFunction' --follow

# ファイル処理Lambda関数のログ  
aws logs tail '/aws/lambda/FileUploadStack-FileProcessor' --follow
```

### 2. S3バケット監視
```bash
# アップロードされたファイル確認
aws s3 ls s3://your-upload-bucket/uploads/ --recursive

# 処理済みファイル確認
aws s3 ls s3://your-processed-bucket/processed/ --recursive
```

## 📚 次のステップ

1. ✅ Sample 03 完了
2. 🖼️ 実際に画像ファイルをアップロードしてS3での処理を確認
3. 📝 CloudWatch Logsでファイル処理の流れを追跡
4. 🔧 新しいファイル処理ロジックを追加
5. 🚀 Sample 04（Blog Backend System）に挑戦

## 🔗 参考リンク

- [Amazon S3 イベント通知](https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html)
- [Lambda S3 トリガー](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html)
- [S3 署名付きURL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Python Boto3 S3](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html)

---

**🎉 おめでとうございます！** 
本格的なファイルアップロードシステムが完成しました。イベント駆動アーキテクチャとセキュアなファイル処理の基礎を習得できました。