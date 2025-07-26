// 📚 TypeScript学習ポイント: フルスタックアプリケーション用import
// React + Cognito認証のモダンフルスタックアプリケーションのライブラリを取り込み
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// Cognito（ユーザー認証・認可）
import * as cognito from 'aws-cdk-lib/aws-cognito';
// API Gateway（バックエンドAPI）
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// Lambda（ビジネスロジック）
import * as lambda from 'aws-cdk-lib/aws-lambda';
// DynamoDB（データ永続化）
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// S3（フロントエンド配信）
import * as s3 from 'aws-cdk-lib/aws-s3';
// CloudFront（CDN配信）
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// S3 Deployment（ビルド済みReactアプリのデプロイ）
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
// IAM（権限管理）
import * as iam from 'aws-cdk-lib/aws-iam';
// AppSync（GraphQL API）
import * as appsync from 'aws-cdk-lib/aws-appsync';
// SNS（リアルタイム通知）
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// CloudWatch（ログ・監視）
import * as logs from 'aws-cdk-lib/aws-logs';

// 📚 TypeScript学習ポイント: Todo項目の型定義
interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

// 📚 TypeScript学習ポイント: フルスタックアプリケーション設定インターフェース
interface FullstackTodoStackProps extends cdk.StackProps {
  // プロジェクト名
  projectName?: string;
  // 環境名（dev, staging, prod等）
  environment?: string;
  // ドメイン名（カスタムドメイン使用時）
  domainName?: string;
  // React アプリのソースパス
  frontendSourcePath?: string;
  // リアルタイム同期を有効にするか
  enableRealTimeSync?: boolean;
  // ソーシャルログインを有効にするか
  enableSocialLogin?: boolean;
  // PWA（Progressive Web App）機能を有効にするか
  enablePWA?: boolean;
  // 多言語対応を有効にするか
  enableI18n?: boolean;
  // オフライン機能を有効にするか
  enableOfflineMode?: boolean;
}

// 📚 TypeScript学習ポイント: フルスタックTodoアプリメインクラス
export class FullstackTodoStack extends cdk.Stack {
  // 📚 TypeScript学習ポイント: パブリックプロパティ（外部アクセス用）
  public readonly websiteUrl: string;
  public readonly apiUrl: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly identityPoolId: string;

  constructor(scope: Construct, id: string, props: FullstackTodoStackProps = {}) {
    super(scope, id, props);

    // 📚 TypeScript学習ポイント: デフォルト値の設定
    const projectName = props.projectName || 'fullstack-todo';
    const environment = props.environment || 'dev';
    const frontendSourcePath = props.frontendSourcePath || './samples/08-fullstack-todo/frontend';
    const enableRealTimeSync = props.enableRealTimeSync !== false; // デフォルトtrue
    const enableSocialLogin = props.enableSocialLogin || false;
    const enablePWA = props.enablePWA || true;
    const enableI18n = props.enableI18n || false;
    const enableOfflineMode = props.enableOfflineMode || true;

    // 📊 DynamoDB テーブル（Todo項目の永続化）
    // 📚 AWS学習ポイント: NoSQLデータベース設計
    const todosTable = new dynamodb.Table(this, 'TodosTable', {
      tableName: `${projectName}-todos-${environment}`,
      
      // プライマリキー設計
      partitionKey: {
        name: 'userId',              // ユーザーID（複数ユーザー対応）
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'todoId',              // Todo ID（ユーザー内での一意性）
        type: dynamodb.AttributeType.STRING,
      },
      
      // 📚 AWS学習ポイント: オンデマンド課金（スケーラブル）
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // 📚 AWS学習ポイント: DynamoDB Streams（リアルタイム同期用）
      stream: enableRealTimeSync ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES : undefined,
      
      // 📚 AWS学習ポイント: ポイントインタイムリカバリ
      pointInTimeRecovery: environment === 'prod',
      
      // 📚 AWS学習ポイント: グローバルセカンダリインデックス（検索最適化）
      globalSecondaryIndexes: [
        {
          indexName: 'CompletedIndex',
          partitionKey: {
            name: 'userId',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'completed',
            type: dynamodb.AttributeType.STRING,
          },
        },
        {
          indexName: 'PriorityIndex',
          partitionKey: {
            name: 'userId',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'priority',
            type: dynamodb.AttributeType.STRING,
          },
        },
        {
          indexName: 'DueDateIndex',
          partitionKey: {
            name: 'userId',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'dueDate',
            type: dynamodb.AttributeType.STRING,
          },
        },
      ],
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 👤 Cognito User Pool（ユーザー管理）
    // 📚 AWS学習ポイント: 包括的なユーザー認証システム
    const userPool = new cognito.UserPool(this, 'TodoUserPool', {
      userPoolName: `${projectName}-users-${environment}`,
      
      // 📚 AWS学習ポイント: サインイン設定
      signInAliases: {
        email: true,                 // メールアドレスでサインイン
        username: true,              // ユーザー名でサインイン
      },
      
      // 📚 AWS学習ポイント: ユーザー属性設定
      standardAttributes: {
        email: {
          required: true,            // メールアドレス必須
          mutable: true,             // 変更可能
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },
      
      // 📚 AWS学習ポイント: カスタム属性
      customAttributes: {
        'user_theme': new cognito.StringAttribute({
          mutable: true,
        }),
        'notification_preferences': new cognito.StringAttribute({
          mutable: true,
        }),
      },
      
      // 📚 AWS学習ポイント: パスワードポリシー
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,       // シンボル不要（ユーザビリティ重視）
      },
      
      // 📚 AWS学習ポイント: アカウント復旧設定
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      // 📚 AWS学習ポイント: MFA設定
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      
      // 📚 AWS学習ポイント: メール設定
      emailSettings: {
        from: `noreply@${props.domainName || 'example.com'}`,
        replyTo: `support@${props.domainName || 'example.com'}`,
      },
      
      // 📚 AWS学習ポイント: Lambda トリガー（カスタマイズ）
      lambdaTriggers: {
        // ユーザー登録後の処理
        postConfirmation: new lambda.Function(this, 'PostConfirmationTrigger', {
          runtime: lambda.Runtime.PYTHON_3_11,
          handler: 'post_confirmation.lambda_handler',
          code: lambda.Code.fromInline(`
import json
import boto3

dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    📚 実装内容: ユーザー登録完了後の初期化処理
    """
    user_id = event['request']['userAttributes']['sub']
    email = event['request']['userAttributes']['email']
    
    # 📚 ウェルカムTodoを自動作成
    table_name = '${todosTable.tableName}'
    table = dynamodb.Table(table_name)
    
    welcome_todos = [
        {
            'userId': user_id,
            'todoId': 'welcome-1',
            'title': 'Welcome to Todo App! 🎉',
            'description': 'This is your first todo item. Click to mark it as completed!',
            'completed': 'false',
            'priority': 'medium',
            'createdAt': '${new Date().toISOString()}',
            'updatedAt': '${new Date().toISOString()}'
        },
        {
            'userId': user_id,
            'todoId': 'welcome-2',
            'title': 'Explore the features',
            'description': 'Try adding, editing, and organizing your todos.',
            'completed': 'false',
            'priority': 'low',
            'createdAt': '${new Date().toISOString()}',
            'updatedAt': '${new Date().toISOString()}'
        },
        {
            'userId': user_id,
            'todoId': 'welcome-3',
            'title': 'Customize your experience',
            'description': 'Check out the settings to personalize your todo app.',
            'completed': 'false',
            'priority': 'low',
            'createdAt': '${new Date().toISOString()}',
            'updatedAt': '${new Date().toISOString()}'
        }
    ]
    
    # ウェルカムTodoを一括作成
    for todo in welcome_todos:
        table.put_item(Item=todo)
    
    print(f'Created welcome todos for user: {user_id}')
    return event
          `),
          environment: {
            TODOS_TABLE_NAME: todosTable.tableName,
          },
        }),
      },
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 📚 AWS学習ポイント: Lambda トリガーの DynamoDB アクセス権限
    const postConfirmationTrigger = userPool.node.findChild('PostConfirmationTrigger') as lambda.Function;
    todosTable.grantWriteData(postConfirmationTrigger);

    // 👤 User Pool Client（フロントエンドアプリ用）
    const userPoolClient = new cognito.UserPoolClient(this, 'TodoUserPoolClient', {
      userPool: userPool,
      userPoolClientName: `${projectName}-client-${environment}`,
      
      // 📚 AWS学習ポイント: OAuth設定
      generateSecret: false,       // SPAはシークレット不要
      authFlows: {
        userPassword: true,        // ユーザー名・パスワード認証
        userSrp: true,            // SRP（Secure Remote Password）
        custom: true,             // カスタム認証
        adminUserPassword: true,   // 管理者による認証
      },
      
      // 📚 AWS学習ポイント: OAuth スコープ
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${props.domainName || 'localhost:3000'}/auth/callback`,
        ],
        logoutUrls: [
          `https://${props.domainName || 'localhost:3000'}/auth/logout`,
        ],
      },
      
      // 📚 AWS学習ポイント: トークン有効期限
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // 🔐 Identity Pool（AWS リソースアクセス用）
    // 📚 AWS学習ポイント: Cognito Federated Identities
    const identityPool = new cognito.CfnIdentityPool(this, 'TodoIdentityPool', {
      identityPoolName: `${projectName}_identity_pool_${environment}`,
      allowUnauthenticatedIdentities: false, // 認証必須
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // 📚 AWS学習ポイント: IAM ロール（認証済みユーザー用）
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // 📚 AWS学習ポイント: きめ細かい権限制御
    // ユーザーは自分のTodoデータのみアクセス可能
    authenticatedRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
      ],
      resources: [
        todosTable.tableArn,
        `${todosTable.tableArn}/index/*`,
      ],
      conditions: {
        'ForAllValues:StringEquals': {
          'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
        },
      },
    }));

    // Identity Pool ロール アタッチ
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // ⚡ Todo管理用Lambda関数
    // 📚 AWS学習ポイント: 高度なCRUD操作とビジネスロジック
    const todoApiFunction = new lambda.Function(this, 'TodoApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'todo_api.lambda_handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('${todosTable.tableName}')

def lambda_handler(event, context):
    """
    📚 実装内容: Todo CRUD 操作とビジネスロジック
    """
    try:
        method = event['httpMethod']
        path = event['path']
        user_id = event['requestContext']['authorizer']['claims']['sub']
        
        print(f'Processing {method} {path} for user {user_id}')
        
        if method == 'GET' and path == '/todos':
            return get_todos(user_id, event.get('queryStringParameters', {}))
            
        elif method == 'POST' and path == '/todos':
            return create_todo(user_id, json.loads(event['body']))
            
        elif method == 'GET' and '/todos/' in path:
            todo_id = path.split('/')[-1]
            return get_todo(user_id, todo_id)
            
        elif method == 'PUT' and '/todos/' in path:
            todo_id = path.split('/')[-1]
            return update_todo(user_id, todo_id, json.loads(event['body']))
            
        elif method == 'DELETE' and '/todos/' in path:
            todo_id = path.split('/')[-1]
            return delete_todo(user_id, todo_id)
            
        elif method == 'GET' and path == '/todos/stats':
            return get_todo_stats(user_id)
            
        else:
            return {
                'statusCode': 404,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Not found'})
            }
            
    except Exception as e:
        print(f'Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': str(e)})
        }

def get_todos(user_id, query_params):
    """Todo一覧取得（フィルタリング・ソート対応）"""
    try:
        # 📚 クエリパラメータの処理
        completed = query_params.get('completed')
        priority = query_params.get('priority')
        limit = int(query_params.get('limit', 50))
        sort_by = query_params.get('sort', 'createdAt')
        order = query_params.get('order', 'desc')
        
        # 📚 基本クエリ
        response = table.query(
            KeyConditionExpression='userId = :user_id',
            ExpressionAttributeValues={
                ':user_id': user_id
            },
            Limit=limit,
            ScanIndexForward=(order == 'asc')
        )
        
        todos = response['Items']
        
        # 📚 フィルタリング
        if completed is not None:
            todos = [t for t in todos if t['completed'] == completed]
        
        if priority:
            todos = [t for t in todos if t['priority'] == priority]
        
        # 📚 ソート
        if sort_by in ['title', 'dueDate', 'priority']:
            reverse = (order == 'desc')
            todos.sort(key=lambda x: x.get(sort_by, ''), reverse=reverse)
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'todos': decimal_default(todos),
                'count': len(todos),
                'total': response.get('Count', 0)
            })
        }
        
    except Exception as e:
        raise Exception(f'Failed to get todos: {str(e)}')

def create_todo(user_id, todo_data):
    """新しいTodo作成"""
    try:
        todo_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        # 📚 入力値検証
        title = todo_data.get('title', '').strip()
        if not title:
            return {
                'statusCode': 400,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Title is required'})
            }
        
        # 📚 期日の検証
        due_date = todo_data.get('dueDate')
        if due_date:
            try:
                # ISO形式の日付文字列を検証
                datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            except ValueError:
                return {
                    'statusCode': 400,
                    'headers': get_cors_headers(),
                    'body': json.dumps({'error': 'Invalid due date format'})
                }
        
        # 📚 Todo項目作成
        todo_item = {
            'userId': user_id,
            'todoId': todo_id,
            'title': title,
            'description': todo_data.get('description', ''),
            'completed': 'false',
            'priority': todo_data.get('priority', 'medium'),
            'dueDate': due_date,
            'createdAt': now,
            'updatedAt': now,
            'tags': todo_data.get('tags', []),
            'estimatedMinutes': todo_data.get('estimatedMinutes', 0)
        }
        
        table.put_item(Item=todo_item)
        
        return {
            'statusCode': 201,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Todo created successfully',
                'todo': decimal_default(todo_item)
            })
        }
        
    except Exception as e:
        raise Exception(f'Failed to create todo: {str(e)}')

def update_todo(user_id, todo_id, update_data):
    """Todo更新"""
    try:
        now = datetime.utcnow().isoformat()
        
        # 📚 動的な更新式を構築
        update_expression = 'SET updatedAt = :updated_at'
        expression_values = {':updated_at': now}
        expression_names = {}
        
        # 📚 更新可能フィールドの処理
        updatable_fields = ['title', 'description', 'completed', 'priority', 'dueDate', 'tags', 'estimatedMinutes']
        
        for field in updatable_fields:
            if field in update_data:
                # 予約語対策
                attr_name = f'#{field}'
                attr_value = f':{field}'
                
                update_expression += f', {attr_name} = {attr_value}'
                expression_names[attr_name] = field
                expression_values[attr_value] = update_data[field]
        
        response = table.update_item(
            Key={'userId': user_id, 'todoId': todo_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values,
            ReturnValues='ALL_NEW'
        )
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Todo updated successfully',
                'todo': decimal_default(response['Attributes'])
            })
        }
        
    except Exception as e:
        raise Exception(f'Failed to update todo: {str(e)}')

def delete_todo(user_id, todo_id):
    """Todo削除"""
    try:
        table.delete_item(
            Key={'userId': user_id, 'todoId': todo_id}
        )
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({'message': 'Todo deleted successfully'})
        }
        
    except Exception as e:
        raise Exception(f'Failed to delete todo: {str(e)}')

def get_todo_stats(user_id):
    """ユーザーのTodo統計取得"""
    try:
        response = table.query(
            KeyConditionExpression='userId = :user_id',
            ExpressionAttributeValues={':user_id': user_id}
        )
        
        todos = response['Items']
        
        # 📚 統計計算
        total_count = len(todos)
        completed_count = len([t for t in todos if t['completed'] == 'true'])
        
        priority_counts = {'high': 0, 'medium': 0, 'low': 0}
        for todo in todos:
            priority = todo.get('priority', 'medium')
            if priority in priority_counts:
                priority_counts[priority] += 1
        
        # 📚 期日関連統計
        overdue_count = 0
        due_today_count = 0
        today = datetime.utcnow().date()
        
        for todo in todos:
            if todo.get('dueDate') and todo['completed'] == 'false':
                due_date = datetime.fromisoformat(todo['dueDate'].replace('Z', '+00:00')).date()
                if due_date < today:
                    overdue_count += 1
                elif due_date == today:
                    due_today_count += 1
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'total': total_count,
                'completed': completed_count,
                'pending': total_count - completed_count,
                'completion_rate': round((completed_count / total_count) * 100, 1) if total_count > 0 else 0,
                'priority_counts': priority_counts,
                'overdue': overdue_count,
                'due_today': due_today_count
            })
        }
        
    except Exception as e:
        raise Exception(f'Failed to get stats: {str(e)}')

def get_cors_headers():
    """CORS ヘッダー"""
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

def decimal_default(obj):
    """DynamoDB Decimal型のJSON変換"""
    if isinstance(obj, list):
        return [decimal_default(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: decimal_default(value) for key, value in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    return obj
      `),
      environment: {
        TODOS_TABLE_NAME: todosTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Lambda の DynamoDB アクセス権限
    todosTable.grantReadWriteData(todoApiFunction);

    // 🌐 API Gateway（バックエンドAPI）
    // 📚 AWS学習ポイント: Cognito認証付きRESTful API
    const api = new apigateway.RestApi(this, 'TodoApi', {
      restApiName: `${projectName}-api-${environment}`,
      description: 'Fullstack Todo Application API',
      
      // 📚 AWS学習ポイント: Cognito オーソライザー
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
      deployOptions: {
        stageName: environment,
      },
    });

    // 📚 AWS学習ポイント: Cognito オーソライザーの設定
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'TodoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'TodoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // Lambda統合
    const lambdaIntegration = new apigateway.LambdaIntegration(todoApiFunction);

    // 📚 API設計学習ポイント: RESTful Todo API エンドポイント

    // /todos リソース
    const todosResource = api.root.addResource('todos');
    
    // GET /todos - Todo一覧取得
    todosResource.addMethod('GET', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // POST /todos - Todo作成
    todosResource.addMethod('POST', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /todos/stats - 統計取得
    const statsResource = todosResource.addResource('stats');
    statsResource.addMethod('GET', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /todos/{id} - 個別Todo操作
    const todoResource = todosResource.addResource('{id}');
    
    todoResource.addMethod('GET', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    todoResource.addMethod('PUT', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    todoResource.addMethod('DELETE', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // 🗄️ フロントエンド配信用S3バケット
    // 📚 AWS学習ポイント: React SPA 配信設定
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${projectName}-website-${environment}-${this.account}`,
      
      // 📚 AWS学習ポイント: SPA用静的サイト設定
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing対応
      
      // 公開読み取り
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 🌐 CloudFront ディストリビューション
    // 📚 AWS学習ポイント: SPA配信に最適化されたCDN
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      
      // 📚 AWS学習ポイント: SPA ルーティング対応のエラーハンドリング
      errorResponses: [
        {
          httpStatus: 404,
          responsePagePath: '/index.html', // SPA routing 対応
          responseHttpStatus: 200,
        },
        {
          httpStatus: 403,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
        },
      ],
      
      defaultRootObject: 'index.html',
      comment: `${projectName} React App Distribution`,
    });

    // 📤 React アプリのデプロイ（予定地）
    // 注：実際のReactアプリビルドファイルが必要
    try {
      new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        sources: [s3deploy.Source.asset(frontendSourcePath)],
        destinationBucket: websiteBucket,
        distribution: distribution,
        distributionPaths: ['/*'],
      });
    } catch (error) {
      // フロントエンドソースがない場合はデモHTMLを配置
      new s3deploy.BucketDeployment(this, 'DeployDemoWebsite', {
        sources: [s3deploy.Source.jsonData('index.html', `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fullstack Todo App</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .config { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .code { font-family: monospace; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔨 Fullstack Todo App - Under Construction</h1>
        <p>Your React Todo application will be deployed here.</p>
        
        <h3>📋 Configuration for your React App:</h3>
        <div class="config">
            <p><strong>API URL:</strong> <span class="code">${api.url}</span></p>
            <p><strong>User Pool ID:</strong> <span class="code">${userPool.userPoolId}</span></p>
            <p><strong>User Pool Client ID:</strong> <span class="code">${userPoolClient.userPoolClientId}</span></p>
            <p><strong>Identity Pool ID:</strong> <span class="code">${identityPool.ref}</span></p>
            <p><strong>Region:</strong> <span class="code">${this.region}</span></p>
        </div>
        
        <h3>🚀 Next Steps:</h3>
        <ol>
            <li>Build your React app with the above configuration</li>
            <li>Deploy the built files to: <span class="code">${frontendSourcePath}</span></li>
            <li>Re-deploy this CDK stack</li>
        </ol>
        
        <h3>📚 Features to implement:</h3>
        <ul>
            <li>User authentication with AWS Cognito</li>
            <li>Todo CRUD operations</li>
            <li>Real-time sync (if enabled)</li>
            <li>Offline mode (if enabled)</li>
            <li>Progressive Web App features</li>
        </ul>
    </div>
</body>
</html>
        `)],
        destinationBucket: websiteBucket,
        distribution: distribution,
        distributionPaths: ['/*'],
      });
    }

    // 📚 TypeScript学習ポイント: プロパティへの代入
    this.websiteUrl = `https://${distribution.distributionDomainName}`;
    this.apiUrl = api.url;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
    this.identityPoolId = identityPool.ref;

    // 📤 CloudFormation出力
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: this.websiteUrl,
      description: 'フルスタックTodoアプリのURL',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'Todo API のベースURL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPoolId,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS リージョン',
    });

    // 📚 便利な出力: React設定用JSON
    new cdk.CfnOutput(this, 'ReactConfigJson', {
      value: JSON.stringify({
        apiUrl: this.apiUrl,
        userPoolId: this.userPoolId,
        userPoolClientId: this.userPoolClientId,
        identityPoolId: this.identityPoolId,
        region: this.region,
      }),
      description: 'React アプリ用設定（JSON形式）',
    });

    // 📚 TypeScript学習まとめ（このファイルで学んだ新しい概念）:
    // ✅ ユニオン型: 'low' | 'medium' | 'high'
    // ✅ オプショナルプロパティ: property?: type
    // ✅ 配列の高度な操作: filter(), find(), sort()
    // ✅ try-catch エラーハンドリング
    // ✅ テンプレートリテラル内での式展開
    // ✅ 条件付きプロパティ: condition ? value : undefined
    // ✅ 動的オブジェクト構築: computed property names

    // 📚 AWS学習まとめ（このファイルで学んだサービス・概念）:
    // ✅ Cognito User Pool: 包括的ユーザー認証システム
    // ✅ Cognito Identity Pool: AWS リソースへのアクセス制御
    // ✅ Lambda Triggers: ユーザーライフサイクルイベント処理
    // ✅ DynamoDB Advanced: GSI、条件付きアクセス、複雑なクエリ
    // ✅ API Gateway Authorizer: Cognito統合認証
    // ✅ CloudFront SPA配信: シングルページアプリケーション最適化
    // ✅ IAM細粒度制御: ユーザー別データアクセス制限
    // ✅ フルスタック認証フロー: フロントエンド〜バックエンド統合認証
  }
}