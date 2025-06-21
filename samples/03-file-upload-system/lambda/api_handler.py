"""
🌐 ファイルアップロードAPI Lambda関数

ファイルアップロード・ダウンロード・管理のためのREST API を提供します。
署名付きURLを使用してセキュアなファイル操作を実現します。
"""

import json
import boto3
import uuid
import os
from datetime import datetime, timedelta
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


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway からのリクエストを処理
    """
    try:
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '/')
        path_parameters = event.get('pathParameters') or {}
        body = event.get('body')
        
        if body:
            body = json.loads(body)
        
        logger.info(f"API Request: {http_method} {path}")
        
        # ルーティング
        if path == '/upload' and http_method == 'POST':
            return get_upload_url(body)
        elif path == '/files' and http_method == 'GET':
            return list_files()
        elif path.startswith('/files/') and http_method == 'GET':
            file_id = path_parameters.get('fileId')
            return get_file_info(file_id)
        elif path.startswith('/files/') and http_method == 'DELETE':
            file_id = path_parameters.get('fileId')
            return delete_file(file_id)
        elif path.startswith('/download/') and http_method == 'GET':
            file_id = path_parameters.get('fileId')
            return get_download_url(file_id)
        elif path.startswith('/status/') and http_method == 'GET':
            file_id = path_parameters.get('fileId')
            return get_processing_status(file_id)
        else:
            return create_response(404, {'error': 'Endpoint not found'})
            
    except Exception as e:
        logger.error(f"API Error: {str(e)}")
        return create_response(500, {'error': 'Internal server error'})


def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    API Gateway レスポンス形式を作成
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key'
        },
        'body': json.dumps(body, ensure_ascii=False, indent=2)
    }


def get_upload_url(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    ファイルアップロード用の署名付きURL を生成
    """
    try:
        if not body:
            return create_response(400, {'error': 'Request body required'})
        
        filename = body.get('filename')
        content_type = body.get('content_type', 'application/octet-stream')
        file_size = body.get('file_size', 0)
        
        if not filename:
            return create_response(400, {'error': 'filename is required'})
        
        # ファイル検証
        if not validate_upload_request(filename, file_size):
            return create_response(400, {'error': 'Invalid file'})
        
        # 一意なファイルIDとキーを生成
        file_id = str(uuid.uuid4())
        file_key = f"uploads/{file_id}/{filename}"
        
        # 署名付きURL生成（15分有効）
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': UPLOAD_BUCKET,
                'Key': file_key,
                'ContentType': content_type,
                'Metadata': {
                    'file-id': file_id,
                    'original-filename': filename,
                    'upload-time': datetime.now().isoformat()
                }
            },
            ExpiresIn=900  # 15分
        )
        
        return create_response(200, {
            'upload_url': presigned_url,
            'file_id': file_id,
            'file_key': file_key,
            'expires_in': 900,
            'instructions': {
                'method': 'PUT',
                'headers': {
                    'Content-Type': content_type
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating upload URL: {str(e)}")
        return create_response(500, {'error': 'Failed to generate upload URL'})


def validate_upload_request(filename: str, file_size: int) -> bool:
    """
    アップロードリクエストの検証
    """
    # ファイル拡張子チェック
    file_extension = os.path.splitext(filename)[1].lower()
    if file_extension not in ALLOWED_FILE_TYPES:
        logger.warning(f"Invalid file type: {file_extension}")
        return False
    
    # ファイルサイズチェック
    max_size_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        logger.warning(f"File too large: {file_size} bytes")
        return False
    
    return True


def list_files() -> Dict[str, Any]:
    """
    アップロード済みファイルの一覧を取得
    """
    try:
        files = []
        
        # アップロードバケットのファイル
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=UPLOAD_BUCKET, Prefix='uploads/'):
            for obj in page.get('Contents', []):
                files.append({
                    'file_id': obj['Key'].split('/')[1],
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'status': 'uploaded',
                    'bucket': 'upload'
                })
        
        # 処理済みバケットのファイル
        for page in paginator.paginate(Bucket=PROCESSED_BUCKET, Prefix='processed/'):
            for obj in page.get('Contents', []):
                files.append({
                    'file_id': obj['Key'].split('/')[2] if len(obj['Key'].split('/')) > 2 else 'unknown',
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'status': 'processed',
                    'bucket': 'processed'
                })
        
        return create_response(200, {
            'files': files,
            'count': len(files)
        })
        
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        return create_response(500, {'error': 'Failed to list files'})


def get_file_info(file_id: str) -> Dict[str, Any]:
    """
    特定ファイルの情報を取得
    """
    try:
        if not file_id:
            return create_response(400, {'error': 'file_id is required'})
        
        # アップロードバケットで検索
        try:
            objects = s3_client.list_objects_v2(
                Bucket=UPLOAD_BUCKET,
                Prefix=f'uploads/{file_id}/'
            )
            
            if 'Contents' in objects:
                obj = objects['Contents'][0]
                metadata = s3_client.head_object(Bucket=UPLOAD_BUCKET, Key=obj['Key'])
                
                return create_response(200, {
                    'file_id': file_id,
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'content_type': metadata.get('ContentType'),
                    'metadata': metadata.get('Metadata', {}),
                    'status': 'uploaded',
                    'bucket': 'upload'
                })
        except:
            pass
        
        # 処理済みバケットで検索
        try:
            objects = s3_client.list_objects_v2(
                Bucket=PROCESSED_BUCKET,
                Prefix=f'processed/uploads/{file_id}/'
            )
            
            if 'Contents' in objects:
                obj = objects['Contents'][0]
                metadata = s3_client.head_object(Bucket=PROCESSED_BUCKET, Key=obj['Key'])
                
                return create_response(200, {
                    'file_id': file_id,
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'content_type': metadata.get('ContentType'),
                    'metadata': metadata.get('Metadata', {}),
                    'status': 'processed',
                    'bucket': 'processed'
                })
        except:
            pass
        
        return create_response(404, {'error': f'File {file_id} not found'})
        
    except Exception as e:
        logger.error(f"Error getting file info: {str(e)}")
        return create_response(500, {'error': 'Failed to get file info'})


def get_download_url(file_id: str) -> Dict[str, Any]:
    """
    ファイルダウンロード用の署名付きURL を生成
    """
    try:
        if not file_id:
            return create_response(400, {'error': 'file_id is required'})
        
        # 処理済みバケットで検索
        objects = s3_client.list_objects_v2(
            Bucket=PROCESSED_BUCKET,
            Prefix=f'processed/uploads/{file_id}/'
        )
        
        if 'Contents' not in objects:
            return create_response(404, {'error': 'File not found or not processed yet'})
        
        file_key = objects['Contents'][0]['Key']
        
        # 署名付きURL生成（1時間有効）
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': PROCESSED_BUCKET,
                'Key': file_key
            },
            ExpiresIn=3600  # 1時間
        )
        
        return create_response(200, {
            'download_url': download_url,
            'file_id': file_id,
            'expires_in': 3600
        })
        
    except Exception as e:
        logger.error(f"Error generating download URL: {str(e)}")
        return create_response(500, {'error': 'Failed to generate download URL'})


def delete_file(file_id: str) -> Dict[str, Any]:
    """
    ファイルを削除
    """
    try:
        if not file_id:
            return create_response(400, {'error': 'file_id is required'})
        
        deleted_files = []
        
        # アップロードバケットから削除
        try:
            objects = s3_client.list_objects_v2(
                Bucket=UPLOAD_BUCKET,
                Prefix=f'uploads/{file_id}/'
            )
            
            for obj in objects.get('Contents', []):
                s3_client.delete_object(Bucket=UPLOAD_BUCKET, Key=obj['Key'])
                deleted_files.append(f"upload:{obj['Key']}")
        except:
            pass
        
        # 処理済みバケットから削除
        try:
            objects = s3_client.list_objects_v2(
                Bucket=PROCESSED_BUCKET,
                Prefix=f'processed/uploads/{file_id}/'
            )
            
            for obj in objects.get('Contents', []):
                s3_client.delete_object(Bucket=PROCESSED_BUCKET, Key=obj['Key'])
                deleted_files.append(f"processed:{obj['Key']}")
        except:
            pass
        
        if not deleted_files:
            return create_response(404, {'error': 'File not found'})
        
        return create_response(200, {
            'message': f'File {file_id} deleted successfully',
            'deleted_files': deleted_files
        })
        
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return create_response(500, {'error': 'Failed to delete file'})


def get_processing_status(file_id: str) -> Dict[str, Any]:
    """
    ファイル処理状況を確認
    """
    try:
        if not file_id:
            return create_response(400, {'error': 'file_id is required'})
        
        # アップロードバケットで確認（未処理）
        upload_objects = s3_client.list_objects_v2(
            Bucket=UPLOAD_BUCKET,
            Prefix=f'uploads/{file_id}/'
        )
        
        # 処理済みバケットで確認（処理済み）
        processed_objects = s3_client.list_objects_v2(
            Bucket=PROCESSED_BUCKET,
            Prefix=f'processed/uploads/{file_id}/'
        )
        
        if 'Contents' in processed_objects:
            status = 'completed'
            message = 'File processing completed'
        elif 'Contents' in upload_objects:
            status = 'processing'
            message = 'File is being processed'
        else:
            status = 'not_found'
            message = 'File not found'
        
        return create_response(200, {
            'file_id': file_id,
            'status': status,
            'message': message
        })
        
    except Exception as e:
        logger.error(f"Error checking processing status: {str(e)}")
        return create_response(500, {'error': 'Failed to check processing status'})