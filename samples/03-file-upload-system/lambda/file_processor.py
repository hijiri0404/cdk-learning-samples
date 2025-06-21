"""
🔧 ファイル処理Lambda関数

S3イベントをトリガーとして実行される、ファイル処理専用のLambda関数です。
アップロードされたファイルの検証、変換、移動などを自動実行します。
"""

import json
import boto3
import os
from urllib.parse import unquote_plus
from typing import Dict, Any
import logging

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS クライアント初期化
s3_client = boto3.client('s3')

# 環境変数取得
UPLOAD_BUCKET = os.environ['UPLOAD_BUCKET']
PROCESSED_BUCKET = os.environ['PROCESSED_BUCKET']
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '10'))
ALLOWED_FILE_TYPES = os.environ.get('ALLOWED_FILE_TYPES', '.jpg,.png,.pdf').split(',')
ENABLE_VIRUS_SCAN = os.environ.get('ENABLE_VIRUS_SCAN', 'false').lower() == 'true'
ENABLE_IMAGE_RESIZE = os.environ.get('ENABLE_IMAGE_RESIZE', 'true').lower() == 'true'


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    S3イベント処理のメインハンドラー
    """
    try:
        # S3イベントの解析
        for record in event['Records']:
            if record['eventSource'] == 'aws:s3':
                process_s3_event(record)
        
        return {'statusCode': 200, 'body': 'Successfully processed files'}
        
    except Exception as e:
        logger.error(f"Error processing event: {str(e)}")
        raise


def process_s3_event(record: Dict[str, Any]) -> None:
    """
    S3イベントレコードを処理
    """
    bucket_name = record['s3']['bucket']['name']
    object_key = unquote_plus(record['s3']['object']['key'])
    event_name = record['eventName']
    
    logger.info(f"Processing {event_name} for {bucket_name}/{object_key}")
    
    if event_name.startswith('ObjectCreated'):
        process_uploaded_file(bucket_name, object_key)
    elif event_name.startswith('ObjectRemoved'):
        logger.info(f"File removed: {object_key}")


def process_uploaded_file(bucket_name: str, object_key: str) -> None:
    """
    アップロードされたファイルを処理
    """
    try:
        # ファイル情報取得
        response = s3_client.head_object(Bucket=bucket_name, Key=object_key)
        file_size = response['ContentLength']
        content_type = response.get('ContentType', '')
        
        logger.info(f"File info: size={file_size}, type={content_type}")
        
        # ファイル検証
        if not validate_file(object_key, file_size, content_type):
            move_to_quarantine(bucket_name, object_key, "Validation failed")
            return
        
        # ファイル処理実行
        if content_type.startswith('image/') and ENABLE_IMAGE_RESIZE:
            process_image(bucket_name, object_key)
        else:
            move_to_processed(bucket_name, object_key)
            
    except Exception as e:
        logger.error(f"Error processing file {object_key}: {str(e)}")
        move_to_quarantine(bucket_name, object_key, f"Processing error: {str(e)}")


def validate_file(object_key: str, file_size: int, content_type: str) -> bool:
    """
    ファイル検証
    """
    # ファイルサイズチェック
    max_size_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        logger.warning(f"File too large: {file_size} bytes (max: {max_size_bytes})")
        return False
    
    # ファイル拡張子チェック
    file_extension = os.path.splitext(object_key)[1].lower()
    if file_extension not in ALLOWED_FILE_TYPES:
        logger.warning(f"Invalid file type: {file_extension}")
        return False
    
    logger.info("File validation passed")
    return True


def process_image(bucket_name: str, object_key: str) -> None:
    """
    画像ファイルの処理（リサイズ等）
    """
    try:
        # 基本的な画像処理（この例では単純にコピー）
        # 実際の実装では PIL/Pillow や Sharp を使用
        
        processed_key = f"processed/{object_key}"
        
        # 元ファイルをダウンロード
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
        file_content = response['Body'].read()
        
        # 処理済みバケットにアップロード
        s3_client.put_object(
            Bucket=PROCESSED_BUCKET,
            Key=processed_key,
            Body=file_content,
            ContentType=response.get('ContentType', 'application/octet-stream'),
            Metadata={
                'original-key': object_key,
                'processed-by': 'file-upload-system',
                'processing-status': 'completed'
            }
        )
        
        logger.info(f"Image processed: {object_key} -> {processed_key}")
        
        # 元ファイル削除
        s3_client.delete_object(Bucket=bucket_name, Key=object_key)
        
    except Exception as e:
        logger.error(f"Error processing image {object_key}: {str(e)}")
        raise


def move_to_processed(bucket_name: str, object_key: str) -> None:
    """
    処理済みバケットに移動
    """
    try:
        processed_key = f"processed/{object_key}"
        
        # ファイルをコピー
        s3_client.copy_object(
            CopySource={'Bucket': bucket_name, 'Key': object_key},
            Bucket=PROCESSED_BUCKET,
            Key=processed_key,
            MetadataDirective='REPLACE',
            Metadata={
                'original-key': object_key,
                'processed-by': 'file-upload-system',
                'processing-status': 'completed'
            }
        )
        
        # 元ファイル削除
        s3_client.delete_object(Bucket=bucket_name, Key=object_key)
        
        logger.info(f"File moved to processed: {object_key}")
        
    except Exception as e:
        logger.error(f"Error moving file {object_key}: {str(e)}")
        raise


def move_to_quarantine(bucket_name: str, object_key: str, reason: str) -> None:
    """
    隔離フォルダに移動
    """
    try:
        quarantine_key = f"quarantine/{object_key}"
        
        # ファイルをコピー
        s3_client.copy_object(
            CopySource={'Bucket': bucket_name, 'Key': object_key},
            Bucket=bucket_name,
            Key=quarantine_key,
            MetadataDirective='REPLACE',
            Metadata={
                'quarantine-reason': reason,
                'original-key': object_key,
                'quarantined-by': 'file-upload-system'
            }
        )
        
        # 元ファイル削除
        s3_client.delete_object(Bucket=bucket_name, Key=object_key)
        
        logger.warning(f"File quarantined: {object_key} (reason: {reason})")
        
    except Exception as e:
        logger.error(f"Error quarantining file {object_key}: {str(e)}")
        raise