"""
🐍 Python学習ポイント: Lambda関数のメインファイル

このファイルはAWS Lambda関数として実行されます。
API Gatewayからのリクエストを受け取り、DynamoDBと連携してレスポンスを返します。

Python初心者の方向けに詳細なコメントを記載しています。
"""

import json      # JSON形式のデータを扱うライブラリ
import boto3     # AWSのPython SDK
import uuid      # 一意なID生成用ライブラリ
import os        # 環境変数を取得するライブラリ
from datetime import datetime  # 日時操作用ライブラリ
from typing import Dict, Any   # 型ヒント用（TypeScriptの型注釈のPython版）

# 🔧 AWS DynamoDBクライアントの初期化
# boto3 = AWS Python SDK、DynamoDBサービスへのクライアント作成
dynamodb = boto3.resource('dynamodb')

# 📚 Python学習ポイント: 環境変数の取得
# os.environ.get() = 環境変数を取得（CDKで設定した値）
table_name = os.environ.get('TABLE_NAME')
environment = os.environ.get('ENVIRONMENT', 'dev')  # デフォルト値'dev'

# DynamoDBテーブルオブジェクト
table = dynamodb.Table(table_name)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    🎯 Lambda関数のメインエントリーポイント
    
    📚 Python学習ポイント: 関数定義と型ヒント
    - def: 関数定義キーワード
    - event: API Gatewayからのリクエスト情報
    - context: Lambda実行環境の情報
    - -> Dict[str, Any]: 戻り値の型（辞書型）
    
    Args:
        event: API Gatewayからのイベントデータ
        context: Lambda実行コンテキスト
        
    Returns:
        API Gatewayへのレスポンス（辞書形式）
    """
    
    # 📚 Python学習ポイント: try-except文（エラーハンドリング）
    try:
        # 📚 Python学習ポイント: 辞書からの値取得
        # event.get() = 辞書から値を取得、存在しない場合はデフォルト値
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '/')
        path_parameters = event.get('pathParameters') or {}
        query_parameters = event.get('queryStringParameters') or {}
        
        # 📚 Python学習ポイント: リクエストボディの解析
        body = event.get('body')
        if body:
            # JSON文字列を辞書に変換
            body = json.loads(body)
        
        # 📚 Python学習ポイント: ログ出力
        print(f"📥 Request: {http_method} {path}")
        print(f"📄 Body: {body}")
        
        # 📚 Python学習ポイント: 条件分岐とルーティング
        # if-elif-else文でHTTPメソッドとパスに応じて処理を分岐
        
        if path == '/health':
            # ヘルスチェックエンドポイント
            return create_response(200, {
                'status': 'healthy',
                'environment': environment,
                'timestamp': datetime.now().isoformat()
            })
            
        elif path == '/items':
            # /items エンドポイント
            if http_method == 'GET':
                # 全アイテム取得
                return get_all_items(query_parameters)
            elif http_method == 'POST':
                # 新しいアイテム作成
                return create_item(body)
                
        elif path.startswith('/items/'):
            # /items/{id} エンドポイント
            item_id = path_parameters.get('id')
            
            if not item_id:
                return create_response(400, {'error': 'Item ID is required'})
                
            if http_method == 'GET':
                # 特定アイテム取得
                return get_item(item_id)
            elif http_method == 'PUT':
                # アイテム更新
                return update_item(item_id, body)
            elif http_method == 'DELETE':
                # アイテム削除
                return delete_item(item_id)
        
        # 該当するエンドポイントがない場合
        return create_response(404, {'error': 'Endpoint not found'})
        
    except Exception as e:
        # 📚 Python学習ポイント: 例外処理
        # 予期しないエラーが発生した場合の処理
        print(f"❌ Error: {str(e)}")
        return create_response(500, {'error': 'Internal server error', 'details': str(e)})


def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    🔧 API Gateway用のレスポンス形式を作成
    
    📚 Python学習ポイント: 関数の定義と辞書の作成
    
    Args:
        status_code: HTTPステータスコード（200, 404, 500等）
        body: レスポンスボディ（辞書形式）
        
    Returns:
        API Gateway形式のレスポンス
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            # CORS対応（クロスオリジンリクエスト許可）
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key'
        },
        # 📚 Python学習ポイント: JSON形式への変換
        # json.dumps() = 辞書をJSON文字列に変換
        'body': json.dumps(body, ensure_ascii=False, indent=2)
    }


def get_all_items(query_params: Dict[str, str]) -> Dict[str, Any]:
    """
    📋 全アイテムを取得する関数
    
    📚 DynamoDB学習ポイント: scan操作
    scanは全データを取得（小規模データ向け）
    
    Args:
        query_params: クエリパラメータ（limit等）
        
    Returns:
        全アイテムのリスト
    """
    try:
        # 📚 Python学習ポイント: 文字列から数値への変換
        # int() = 文字列を整数に変換、エラーの場合はexceptで処理
        limit = None
        if 'limit' in query_params:
            try:
                limit = int(query_params['limit'])
            except ValueError:
                return create_response(400, {'error': 'Invalid limit parameter'})
        
        # 📚 DynamoDB学習ポイント: scan操作の実行
        scan_kwargs = {}
        if limit:
            scan_kwargs['Limit'] = limit
            
        response = table.scan(**scan_kwargs)
        
        # 📚 Python学習ポイント: リスト内包表記
        # [処理 for 要素 in リスト] = 各要素に処理を適用した新しいリスト作成
        items = [format_item(item) for item in response['Items']]
        
        return create_response(200, {
            'items': items,
            'count': len(items),
            'message': f'Successfully retrieved {len(items)} items'
        })
        
    except Exception as e:
        print(f"❌ Error getting all items: {str(e)}")
        return create_response(500, {'error': 'Failed to retrieve items'})


def get_item(item_id: str) -> Dict[str, Any]:
    """
    🔍 特定のアイテムを取得する関数
    
    📚 DynamoDB学習ポイント: get_item操作
    プライマリキーを指定してデータを取得
    
    Args:
        item_id: 取得するアイテムのID
        
    Returns:
        アイテムデータ
    """
    try:
        response = table.get_item(Key={'id': item_id})
        
        # 📚 Python学習ポイント: 辞書のキー存在確認
        if 'Item' not in response:
            return create_response(404, {'error': f'Item with id {item_id} not found'})
        
        item = format_item(response['Item'])
        return create_response(200, {'item': item})
        
    except Exception as e:
        print(f"❌ Error getting item {item_id}: {str(e)}")
        return create_response(500, {'error': 'Failed to retrieve item'})


def create_item(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    ➕ 新しいアイテムを作成する関数
    
    📚 DynamoDB学習ポイント: put_item操作
    新しいデータをテーブルに保存
    
    Args:
        body: 作成するアイテムのデータ
        
    Returns:
        作成されたアイテム
    """
    try:
        if not body:
            return create_response(400, {'error': 'Request body is required'})
        
        # 📚 Python学習ポイント: UUID生成
        # uuid.uuid4() = ランダムな一意識別子を生成
        item_id = str(uuid.uuid4())
        
        # 📚 Python学習ポイント: 現在時刻の取得
        current_time = datetime.now().isoformat()
        
        # 新しいアイテムのデータ構造
        item = {
            'id': item_id,
            'name': body.get('name', 'Untitled'),
            'description': body.get('description', ''),
            'category': body.get('category', 'general'),
            'created_at': current_time,
            'updated_at': current_time,
            'status': 'active'
        }
        
        # 📚 カスタムフィールドの追加
        # bodyに含まれる追加フィールドをアイテムに追加
        for key, value in body.items():
            if key not in ['id', 'created_at', 'updated_at']:
                item[key] = value
        
        # DynamoDBに保存
        table.put_item(Item=item)
        
        formatted_item = format_item(item)
        return create_response(201, {
            'item': formatted_item,
            'message': f'Item {item_id} created successfully'
        })
        
    except Exception as e:
        print(f"❌ Error creating item: {str(e)}")
        return create_response(500, {'error': 'Failed to create item'})


def update_item(item_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    ✏️ 既存のアイテムを更新する関数
    
    📚 DynamoDB学習ポイント: update_item操作
    既存データの一部を更新
    
    Args:
        item_id: 更新するアイテムのID
        body: 更新データ
        
    Returns:
        更新されたアイテム
    """
    try:
        if not body:
            return create_response(400, {'error': 'Request body is required'})
        
        # まず既存アイテムの存在確認
        existing_response = table.get_item(Key={'id': item_id})
        if 'Item' not in existing_response:
            return create_response(404, {'error': f'Item with id {item_id} not found'})
        
        # 📚 Python学習ポイント: 文字列結合とリスト操作
        # DynamoDB UpdateExpressionの構築
        update_expression = "SET updated_at = :updated_at"
        expression_values = {':updated_at': datetime.now().isoformat()}
        
        # 更新対象フィールドの処理
        for key, value in body.items():
            if key not in ['id', 'created_at']:  # 変更不可フィールドを除外
                # 📚 Python学習ポイント: f文字列（フォーマット文字列）
                update_expression += f", {key} = :{key}"
                expression_values[f":{key}"] = value
        
        # DynamoDBの更新実行
        response = table.update_item(
            Key={'id': item_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ReturnValues='ALL_NEW'  # 更新後の全データを返す
        )
        
        formatted_item = format_item(response['Attributes'])
        return create_response(200, {
            'item': formatted_item,
            'message': f'Item {item_id} updated successfully'
        })
        
    except Exception as e:
        print(f"❌ Error updating item {item_id}: {str(e)}")
        return create_response(500, {'error': 'Failed to update item'})


def delete_item(item_id: str) -> Dict[str, Any]:
    """
    🗑️ アイテムを削除する関数
    
    📚 DynamoDB学習ポイント: delete_item操作
    指定したキーのデータを削除
    
    Args:
        item_id: 削除するアイテムのID
        
    Returns:
        削除結果
    """
    try:
        # 削除前に存在確認
        existing_response = table.get_item(Key={'id': item_id})
        if 'Item' not in existing_response:
            return create_response(404, {'error': f'Item with id {item_id} not found'})
        
        # DynamoDBから削除
        table.delete_item(Key={'id': item_id})
        
        return create_response(200, {
            'message': f'Item {item_id} deleted successfully',
            'deleted_id': item_id
        })
        
    except Exception as e:
        print(f"❌ Error deleting item {item_id}: {str(e)}")
        return create_response(500, {'error': 'Failed to delete item'})


def format_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    🎨 DynamoDBのアイテムを表示用にフォーマット
    
    📚 Python学習ポイント: 辞書のコピーと操作
    
    Args:
        item: DynamoDBから取得したアイテム
        
    Returns:
        フォーマット済みのアイテム
    """
    # 📚 Python学習ポイント: 辞書のコピー
    # .copy() = 元の辞書を変更せずに新しい辞書を作成
    formatted = item.copy()
    
    # 📚 Python学習ポイント: 辞書のキー存在確認とデフォルト値
    # .get(key, default) = キーが存在すればその値、なければデフォルト値
    if 'created_at' in formatted:
        formatted['created_at_display'] = format_datetime(formatted['created_at'])
    
    if 'updated_at' in formatted:
        formatted['updated_at_display'] = format_datetime(formatted['updated_at'])
    
    return formatted


def format_datetime(iso_string: str) -> str:
    """
    📅 ISO形式の日時文字列を読みやすい形式に変換
    
    📚 Python学習ポイント: 日時の操作
    
    Args:
        iso_string: ISO形式の日時文字列
        
    Returns:
        読みやすい形式の日時文字列
    """
    try:
        # 📚 Python学習ポイント: 日時のパースとフォーマット
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        return dt.strftime('%Y年%m月%d日 %H:%M:%S')
    except Exception:
        return iso_string  # エラーの場合は元の文字列を返す


# 📚 Python学習まとめ（このファイルで使用した概念）:
# ✅ 関数定義: def 関数名(引数): 
# ✅ 型ヒント: 引数: 型, -> 戻り値型
# ✅ 辞書操作: dict.get(), dict['key']
# ✅ 条件分岐: if-elif-else
# ✅ 例外処理: try-except
# ✅ ループ処理: for 要素 in リスト
# ✅ リスト内包表記: [処理 for 要素 in リスト]
# ✅ 文字列操作: f文字列, .format(), .join()
# ✅ JSON操作: json.loads(), json.dumps()
# ✅ 日時操作: datetime.now(), .isoformat()
# ✅ UUID生成: uuid.uuid4()
# ✅ 環境変数: os.environ.get()

# 📚 AWS学習まとめ（このファイルで学んだ概念）:
# ✅ Lambda関数: サーバーレス実行環境
# ✅ DynamoDB: NoSQLデータベース操作
# ✅ API Gateway: REST APIエンドポイント
# ✅ boto3: AWS Python SDK
# ✅ CORS: クロスオリジンリクエスト対応
# ✅ HTTPメソッド: GET, POST, PUT, DELETE
# ✅ RESTful API: リソース指向のAPI設計