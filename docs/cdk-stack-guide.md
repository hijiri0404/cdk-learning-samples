# 📚 CDK完全学習ガイド（TypeScript初心者向け）

> **このガイドの目的**: TypeScript未学習者がAWS CDKを段階的に習得し、実践的なインフラ構築スキルを身につけることを目指します。

## 🎯 目次

1. [CDK基本概念](#1-cdk基本概念)
2. [TypeScript基礎実例集](#2-typescript基礎実例集)
3. [cdk.Stack詳細解説](#3-cdkstack詳細解説)
4. [npm install完全ガイド](#4-npm-install完全ガイド)
5. [よくある質問と回答](#5-よくある質問と回答)
6. [学習ロードマップ](#6-学習ロードマップ)

---

## 1. CDK基本概念

### 🏗️ CDKの3つの核心概念

#### App（アプリケーション）
```typescript
const app = new cdk.App();  // 🏗️ 建設現場全体
```
- CDKプロジェクト全体を管理
- 複数のStackを含む最上位コンテナ

#### Stack（スタック）
```typescript
export class MyStack extends cdk.Stack {  // 🏠 個別の建物
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // AWS リソースをここに定義
  }
}
```
- CloudFormationスタックを表現
- 関連するAWSリソースの集合体
- 独立してデプロイ・削除可能

#### Construct（コンストラクト）
```typescript
const bucket = new s3.Bucket(this, 'MyBucket', {});  // 🚪 建物の部品
```
- 個別のAWSリソース（S3、Lambda等）
- Stackの中に配置される最小単位

### 🔗 階層関係の理解
```
App (建設現場)
├── Stack-A (建物A)
│   ├── S3 Bucket (部品)
│   └── Lambda Function (部品)
└── Stack-B (建物B)
    ├── VPC (部品)
    └── EC2 Instance (部品)
```

---

## 2. TypeScript基礎実例集

### 🎯 学習アプローチ

**1週目**: 基本構文マスター
- 変数宣言（const/let）
- 関数の書き方
- 基本的な型注釈

**2週目**: オブジェクト指向とモジュール
- クラスと継承
- インターフェース
- インポート/エクスポート

### 📝 実践的なTypeScriptパターン

#### パターン1: 変数宣言と型注釈
```typescript
// 🎯 CDKで使われる変数宣言
const stackName: string = 'MyStack';           // 文字列型
const maxInstances: number = 3;                // 数値型
const enableLogging: boolean = true;           // 真偽値型
const allowedRegions: string[] = ['us-east-1', 'ap-northeast-1'];  // 配列型

// 🎯 環境に応じた動的な値設定
const environment = process.env.NODE_ENV || 'dev';
const bucketName = `my-app-${environment}-${Date.now()}`;  // テンプレートリテラル
```

#### パターン2: インターフェースでの型定義
```typescript
// 🎯 CDKスタックの設定を型安全に定義
interface MyStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';  // 特定の値のみ許可
  enableMonitoring?: boolean;                // 省略可能なプロパティ
  maxUsers: number;                          // 必須のプロパティ
}

// 🎯 使用例
const stackProps: MyStackProps = {
  environment: 'dev',
  maxUsers: 100,
  enableMonitoring: true
};
```

#### パターン3: クラス継承とメソッド
```typescript
// 🎯 ベースクラスで共通機能を定義
export class BaseStack extends cdk.Stack {
  protected readonly environment: string;
  
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);
    this.environment = props.environment;
  }
  
  // 🎯 共通メソッド：リソース名の生成
  protected generateResourceName(resourceType: string): string {
    return `${resourceType}-${this.environment}-${this.account}`;
  }
}

// 🎯 継承を活用した専用スタック
export class DatabaseStack extends BaseStack {
  public readonly database: rds.DatabaseInstance;
  
  constructor(scope: Construct, id: string, props: MyStackProps) {
    super(scope, id, props);
    
    // 親クラスのメソッドを活用
    const dbName = this.generateResourceName('database');
    
    this.database = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: dbName,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4
      })
    });
  }
}
```

#### パターン4: 関数とエラーハンドリング
```typescript
// 🎯 設定の検証関数
function validateStackProps(props: MyStackProps): void {
  if (props.maxUsers <= 0) {
    throw new Error('maxUsers must be greater than 0');
  }
  
  const allowedEnvironments = ['dev', 'staging', 'prod'];
  if (!allowedEnvironments.includes(props.environment)) {
    throw new Error(`Invalid environment: ${props.environment}`);
  }
}

// 🎯 条件分岐を使った設定調整
function getInstanceType(environment: string): ec2.InstanceType {
  switch (environment) {
    case 'prod':
      return ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE);
    case 'staging':
      return ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.MEDIUM);
    default:
      return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
  }
}
```

### 💡 CDKでよく使うTypeScript機能

| 機能 | 使用場面 | 例 |
|-----|---------|-----|
| テンプレートリテラル | リソース名生成 | `\`bucket-${env}-${account}\`` |
| オプショナルプロパティ | 設定の省略 | `enableSsl?: boolean` |
| Union型 | 環境の制限 | `'dev' \| 'prod'` |
| 配列操作 | 複数リソース作成 | `regions.map(...)` |
| 分割代入 | プロパティ取得 | `const {region, account} = props` |

---

## 3. cdk.Stack詳細解説

### 🏛️ Stackの基本構造

```typescript
export class MyStack extends cdk.Stack {
  // 📚 プロパティ定義（他のスタックから参照可能）
  public readonly vpc: ec2.Vpc;
  public readonly apiUrl: string;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // 📚 必須：親クラスの初期化
    super(scope, id, props);
    
    // 📚 AWSリソースの定義
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      natGateways: 1
    });
    
    // 📚 出力値の定義
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID for reference'
    });
  }
}
```

### 🔧 Constructor引数の詳細

#### scope: Construct
```typescript
// bin/app.ts での使用例
const app = new cdk.App();              // アプリケーション作成
new MyStack(app, 'MyStack', {});        // appがscope引数
```

#### id: string
```typescript
// 一意な識別子（CloudFormationスタック名になる）
new MyStack(app, 'Development-MyStack', {});
new MyStack(app, 'Production-MyStack', {});
```

#### props?: cdk.StackProps
```typescript
// 環境固有の設定
const prodProps: cdk.StackProps = {
  env: {
    account: '123456789012',
    region: 'ap-northeast-1'
  },
  description: '本番環境用スタック',
  tags: {
    Environment: 'production',
    CostCenter: 'engineering'
  }
};
```

### 🌐 Stack間の連携パターン

#### パターン1: プロパティ経由での連携
```typescript
// VPCスタック
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.vpc = new ec2.Vpc(this, 'Vpc', {});
  }
}

// アプリケーションスタック（VPCを使用）
export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props?: cdk.StackProps) {
    super(scope, id, props);
    
    new ec2.Instance(this, 'WebServer', {
      vpc: vpc,  // 他のスタックのVPCを使用
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO)
    });
  }
}

// bin/app.ts での連携
const networkStack = new NetworkStack(app, 'NetworkStack');
const appStack = new AppStack(app, 'AppStack', networkStack.vpc);
```

#### パターン2: クロススタック参照
```typescript
// 出力側スタック
export class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const database = new rds.DatabaseInstance(this, 'Database', {
      // 設定...
    });
    
    // 他のスタックから参照可能な出力値
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      exportName: 'DatabaseEndpoint'  // エクスポート名
    });
  }
}

// 参照側スタック
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // 他のスタックの出力値をインポート
    const dbEndpoint = cdk.Fn.importValue('DatabaseEndpoint');
    
    new lambda.Function(this, 'ApiFunction', {
      environment: {
        DATABASE_URL: dbEndpoint
      }
    });
  }
}
```

---

## 4. npm install完全ガイド

### 📦 npm installの役割

**npm** = Node Package Manager（Node.jsのパッケージ管理システム）

```bash
npm install  # package.jsonを読み込み、必要なライブラリを自動ダウンロード
```

### 🔍 実行時のプロセス

#### ステップ1: package.json解析
```json
{
  "dependencies": {
    "aws-cdk-lib": "^2.100.0",     // CDKメインライブラリ
    "constructs": "^10.0.0"        // CDK基盤ライブラリ
  },
  "devDependencies": {
    "typescript": "~5.2.2",        // TypeScriptコンパイラ
    "@types/node": "20.6.8"        // Node.js型定義
  }
}
```

#### ステップ2: 依存関係解決とダウンロード
```bash
# npmレジストリから指定バージョンをダウンロード
📥 aws-cdk-lib@2.100.0
📥 constructs@10.3.0
📥 typescript@5.2.2
📥 @types/node@20.6.8
# + 数百個の間接的依存関係
```

#### ステップ3: node_modulesに保存
```
project/
├── package.json         # 📋 依存関係リスト
├── package-lock.json    # 🔒 正確なバージョン記録
└── node_modules/        # 📦 ダウンロードされたライブラリ
    ├── aws-cdk-lib/    # CDKライブラリ
    ├── typescript/     # TypeScriptコンパイラ
    └── (347個のパッケージ)
```

### 🎯 dependencies vs devDependencies

| 種類 | 用途 | デプロイ時 | 例 |
|-----|------|-----------|-----|
| **dependencies** | 本番環境でも必要 | 含まれる | aws-cdk-lib, constructs |
| **devDependencies** | 開発時のみ必要 | 除外される | typescript, jest, @types/* |

### 🔧 よく使うnpmコマンド

```bash
# 基本操作
npm install                    # 全依存関係インストール
npm install express            # 新しいパッケージ追加
npm install --save-dev jest    # 開発用パッケージ追加
npm uninstall express          # パッケージ削除
npm update                     # パッケージ更新

# CDKプロジェクトでよく使用
npm run build                  # TypeScriptコンパイル
npm run test                   # テスト実行
npm run cdk -- deploy MyStack # CDKコマンド実行
```

### ❗ トラブルシューティング

#### よくある問題と解決法

**問題1**: node_modulesが巨大（数百MB）
```bash
# 正常な現象（CDKプロジェクトでは一般的）
du -sh node_modules/  # サイズ確認
# → 約300-500MB（正常）
```

**問題2**: 権限エラー（EACCES）
```bash
# 解決法
npm config set prefix ~/.npm  # ユーザーディレクトリに変更
```

**問題3**: 依存関係の競合
```bash
# 強制的に再インストール
rm -rf node_modules package-lock.json
npm install
```

---

## 5. よくある質問と回答

### 🤔 学習・概念に関する質問

<details>
<summary><strong>Q1: TypeScript初心者がCDKを学ぶ最適な順序は？</strong></summary>

**推奨学習フロー（4-6週間）:**

1. **Week 1-2: TypeScript基礎**
   - 変数宣言、関数、クラス
   - 型注釈、インターフェース
   - この資料の「TypeScript基礎実例集」を実践

2. **Week 3: CDK概念理解**
   - App/Stack/Constructの関係
   - Sample 01 (Hello World Website) 実施

3. **Week 4: サーバーレス基礎**
   - Sample 02 (Simple API Server) 実施
   - Lambda、API Gateway、DynamoDB理解

4. **Week 5-6: 実践応用**
   - Sample 03 (File Upload System) 実施
   - 独自のプロジェクト開始
</details>

<details>
<summary><strong>Q2: CDKとCloudFormationの違いは？</strong></summary>

| 項目 | CloudFormation | CDK |
|------|---------------|-----|
| **記述方法** | YAML/JSON | TypeScript/Python等 |
| **型チェック** | なし | コンパイル時 |
| **IDE支援** | 限定的 | 強力（自動補完等） |
| **再利用性** | テンプレート | クラス・関数 |
| **学習コストー** | 低 | 中（プログラミング知識必要） |
| **保守性** | 中 | 高 |

**CDKの利点:**
- タイプミスをコンパイル時に発見
- コードの再利用が容易
- IDEの強力な支援
- プログラミング言語の機能（ループ、条件分岐等）を活用
</details>

<details>
<summary><strong>Q3: なぜConstructをimportする必要があるの？</strong></summary>

```typescript
import { Construct } from 'constructs';

// ConstructはCDKの基盤クラス
// ↓
// App, Stack, すべてのAWSリソースの親クラス
// ↓  
// 型安全性とIDE支援のために必要

export class MyStack extends cdk.Stack {
  constructor(
    scope: Construct,  // ← この型指定のためにimportが必要
    id: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);
  }
}
```

**重要性:**
- TypeScriptの型安全性確保
- IDEの自動補完機能
- エラーの早期発見
</details>

### 🛠️ 実践・運用に関する質問

<details>
<summary><strong>Q4: 開発環境と本番環境はどう分ける？</strong></summary>

**推奨パターン: 環境別Stack**

```typescript
// 共通インターフェース
interface AppStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    
    // 環境に応じた設定
    const instanceType = this.getInstanceType(props.environment);
    const enableBackup = props.environment === 'prod';
    
    new ec2.Instance(this, 'WebServer', {
      instanceType: instanceType,
      // ...
    });
  }
  
  private getInstanceType(env: string): ec2.InstanceType {
    switch (env) {
      case 'prod': return ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE);
      case 'staging': return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM);
      default: return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
    }
  }
}

// bin/app.ts
const app = new cdk.App();
new AppStack(app, 'MyApp-Dev', { environment: 'dev' });
new AppStack(app, 'MyApp-Prod', { environment: 'prod' });
```
</details>

<details>
<summary><strong>Q5: エラーが出た時のデバッグ方法は？</strong></summary>

**段階的デバッグアプローチ:**

1. **TypeScriptコンパイルエラー**
```bash
npm run build  # エラー詳細を確認
npx tsc --noEmit  # 型チェックのみ実行
```

2. **CDK合成エラー**
```bash
cdk synth YourStack  # CloudFormationテンプレート生成
cdk diff YourStack   # 変更差分を確認
```

3. **デプロイエラー**
```bash
cdk deploy YourStack --verbose  # 詳細ログ出力
# AWSコンソールのCloudFormationでイベント確認
```

4. **一般的なエラーパターン**
```typescript
// ❌ リソース名重複
new s3.Bucket(this, 'MyBucket');
new s3.Bucket(this, 'MyBucket');  // エラー！

// ✅ 一意な識別子
new s3.Bucket(this, 'MyBucket1');
new s3.Bucket(this, 'MyBucket2');
```
</details>

### 💰 コスト・運用に関する質問

<details>
<summary><strong>Q6: 学習時のコストを抑える方法は？</strong></summary>

**コスト最適化戦略:**

1. **無料枠の活用**
```typescript
// 無料枠内で収まるリソース選択
new ec2.Instance(this, 'Instance', {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),  // 750時間/月無料
  // ...
});

new rds.DatabaseInstance(this, 'Database', {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),  // 750時間/月無料
  // ...
});
```

2. **学習後の確実な削除**
```bash
# 全スタック削除
cdk destroy --all

# 特定スタックのみ削除
cdk destroy MyStack
```

3. **コスト発生リソースの回避**
```typescript
// ❌ 高コスト（NAT Gateway: ~$45/月）
new ec2.Vpc(this, 'Vpc', {
  natGateways: 2  // 避ける
});

// ✅ 低コスト（学習用）
new ec2.Vpc(this, 'Vpc', {
  natGateways: 0  // インターネットアクセス不要なら0
});
```
</details>

---

## 6. 学習ロードマップ

### 🎯 段階別学習目標

#### Phase 1: 基礎固め（2-3週間）
- **目標**: CDKの基本概念理解とTypeScript慣れ
- **成果物**: Sample 01-03の完了
- **習得スキル**: 
  - TypeScript基本構文
  - CDK Stack/Construct概念
  - 基本的なAWSサービス（S3, Lambda, API Gateway）

#### Phase 2: 実用スキル（3-4週間）
- **目標**: 実際のアプリケーション構築
- **成果物**: Sample 04-06の完了
- **習得スキル**:
  - データベース連携
  - VPCネットワーク設計
  - 監視・アラート設定

#### Phase 3: プロフェッショナル（4-6週間）
- **目標**: 本格的なシステム構築・運用
- **成果物**: Sample 07-10の完了と独自プロジェクト
- **習得スキル**:
  - マルチ環境管理
  - CI/CDパイプライン
  - セキュリティ設計

### 📚 推奨学習リソース

#### 公式ドキュメント
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

#### 実践的リソース
- [CDK Workshop](https://cdkworkshop.com/) - ハンズオン学習
- [CDK Patterns](https://cdkpatterns.com/) - 実用的パターン集
- [AWS Solutions Constructs](https://aws.amazon.com/solutions/constructs/) - ベストプラクティス集

#### コミュニティ
- [AWS CDK GitHub](https://github.com/aws/aws-cdk) - 最新情報・Issue
- [AWS CDK Slack](https://cdk.dev/) - コミュニティサポート

### 🎉 達成基準

各フェーズ完了時の自己チェックリスト：

#### Phase 1完了基準
- [ ] TypeScriptの基本構文を理解し、説明できる
- [ ] CDKでシンプルなインフラを構築・デプロイできる
- [ ] AWS基本サービスの役割を理解している
- [ ] Sample 01-03を自力で再現できる

#### Phase 2完了基準
- [ ] 複数AWSサービスを連携させたシステムを構築できる
- [ ] 環境別設定管理ができる
- [ ] 基本的なトラブルシューティングができる
- [ ] コストを意識したリソース選択ができる

#### Phase 3完了基準
- [ ] エンタープライズレベルのアーキテクチャを設計できる
- [ ] CI/CDパイプラインを構築できる
- [ ] セキュリティベストプラクティスを適用できる
- [ ] 独自のプロジェクトを完遂できる

---

## 🔗 関連リンク

- [サンプル集](/samples/README.md) - 10個の実践的サンプル
- [AWS公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [TypeScript公式サイト](https://www.typescriptlang.org/)

---

**📝 このガイドについて**

このガイドは継続的に更新されます。質問や改善提案があれば、ぜひIssueやPull Requestでお知らせください。

**最終更新**: 2024年12月
**バージョン**: 2.0.0