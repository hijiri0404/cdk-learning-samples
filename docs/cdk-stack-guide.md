# 📚 cdk.Stack 完全ガイド（TypeScript未学習者向け）

## 🎯 cdk.Stack とは？

`cdk.Stack` は **AWS CloudFormation スタックを表現するクラス** です。

### 🏗️ 建築に例えると
- **cdk.Stack** = 建物の基礎・土台
- **各AWSリソース** = 建物の部品（窓、ドア、電気配線など）
- **bin/app.ts** = 建設現場で実際に建物を建てる指示書

## 📖 TypeScript の継承について

```typescript
// TypeScript: クラスの継承の基本構文
export class S3Stack extends cdk.Stack {
//    ↑我々が作るクラス  ↑親クラス（継承元）
}
```

### 🔗 継承とは？
- **extends** = 「〜を継承する」という意味
- **cdk.Stack** = 親クラス（土台の機能を持つ）
- **S3Stack** = 子クラス（親の機能＋独自の機能）

## 🏛️ Stack の構造

### 基本的な構造
```typescript
import * as cdk from 'aws-cdk-lib';        // CDKライブラリを読み込み
import { Construct } from 'constructs';     // 基本クラスを読み込み

export class MyStack extends cdk.Stack {
  // ↑ export = 他のファイルで使用可能にする
  // ↑ class = クラス（設計図）を定義
  // ↑ extends = 親クラスの機能を継承

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // ↑ constructor = クラスが作られる時に最初に実行される特別な関数
    
    super(scope, id, props);
    // ↑ super() = 親クラス（cdk.Stack）の初期化処理を実行
    
    // ここに AWS リソースを定義
  }
}
```

## 🔧 Constructor の引数詳細

```typescript
constructor(
  scope: Construct,     // このスタックの親（通常はCDKアプリ）
  id: string,          // スタックの識別名
  props?: cdk.StackProps // スタックの設定（?は任意を意味）
)
```

### 📝 各引数の説明

#### 1. scope: Construct
```typescript
// bin/app.ts で以下のように使用：
const app = new cdk.App();           // ← これがscope
new S3Stack(app, 'S3Stack', {});     // appを第1引数として渡す
```

#### 2. id: string
```typescript
new S3Stack(app, 'S3Stack', {});     // ← 'S3Stack'がid
new S3Stack(app, 'MyBucket', {});    // ← 'MyBucket'がid（任意の名前）
```

#### 3. props?: cdk.StackProps
```typescript
// ?マークは「任意」を意味（渡さなくても良い）
new S3Stack(app, 'S3Stack');         // props なし（OK）

new S3Stack(app, 'S3Stack', {        // props あり
  env: {                             // 環境設定
    account: '123456789012',         // AWSアカウントID
    region: 'ap-northeast-1'         // リージョン
  },
  description: 'S3バケット用のスタック' // 説明文
});
```

## 🔄 super() の役割

```typescript
constructor(scope: Construct, id: string, props?: cdk.StackProps) {
  super(scope, id, props);  // ← 必須！親クラスの初期化
  
  // super()の後でないと、thisは使えない
  const bucket = new s3.Bucket(this, 'MyBucket', {});
  //                           ↑ this = 現在のスタックインスタンス
}
```

### ❌ super() を忘れるとエラー
```typescript
constructor(scope: Construct, id: string, props?: cdk.StackProps) {
  // super(scope, id, props); ← これを忘れると...
  
  const bucket = new s3.Bucket(this, 'MyBucket', {}); // エラー！
}
```

## 🎯 Stack の主要プロパティ

### Stack 内で使用できる便利なプロパティ
```typescript
export class ExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Stack の情報にアクセス
    console.log(this.account);        // AWSアカウントID
    console.log(this.region);         // AWSリージョン
    console.log(this.stackName);      // スタック名
    console.log(this.stackId);        // スタックID
    
    // 使用例：リソース名にアカウントIDを含める
    const bucketName = `my-bucket-${this.account}-${this.region}`;
  }
}
```

## 🔗 Stack 間の連携

### パブリックプロパティで他のStackから参照
```typescript
// VPCスタックの例
export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;  // 他のStackから参照可能
  //↑public = 外部アクセス可能
  //↑readonly = 読み取り専用

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    this.vpc = new ec2.Vpc(this, 'MainVpc', {});
    // ↑ this.vpc に代入することで、外部から参照可能になる
  }
}

// 他のStackでVPCを使用
export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc) {
    super(scope, id);
    
    // 渡されたVPCを使用してリソースを作成
    const instance = new ec2.Instance(this, 'AppServer', {
      vpc: vpc,  // 他のStackのVPCを使用
      // その他の設定...
    });
  }
}
```

## 📤 出力（CfnOutput）

```typescript
export class S3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const bucket = new s3.Bucket(this, 'MyBucket', {});
    
    // 出力値の定義
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,           // 出力する値
      description: 'S3バケットの名前',     // 説明
      exportName: 'MyAppBucketName'       // 他のStackから参照可能な名前
    });
  }
}
```

## 🚀 実践例：Stack の作成パターン

### パターン1：基本的なStack
```typescript
export class BasicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // リソースを1つずつ作成
    const bucket = new s3.Bucket(this, 'Bucket', {});
    const func = new lambda.Function(this, 'Function', {});
  }
}
```

### パターン2：設定を受け取るStack
```typescript
// 独自の設定を定義
interface CustomStackProps extends cdk.StackProps {
  bucketName: string;
  environment: string;
}

export class CustomStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CustomStackProps) {
    super(scope, id, props);
    
    // 渡された設定を使用
    const bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: props.bucketName,
      // 環境に応じた設定
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN    // 本番環境では削除しない
        : cdk.RemovalPolicy.DESTROY   // 開発環境では削除OK
    });
  }
}
```

### パターン3：他のStackを参照するStack
```typescript
// bin/app.ts での使用例
const app = new cdk.App();

// まずVPCStackを作成
const vpcStack = new VpcStack(app, 'VpcStack');

// VPCを使用してAppStackを作成
const appStack = new AppStack(app, 'AppStack', {
  vpc: vpcStack.vpc  // VPCStackで作成したVPCを渡す
});
```

## 💡 重要なポイント

### ✅ 覚えておくべきこと
1. **extends cdk.Stack** = CloudFormationスタックを継承
2. **super()** = 親クラスの初期化（必須）
3. **this** = 現在のスタックインスタンス
4. **public readonly** = 他のStackから参照可能
5. **CfnOutput** = スタックの出力値

### ❌ よくある間違い
1. `super()` を呼び忘れる
2. `this` を `super()` より前で使う
3. Stack間の依存関係を考えずに作成順序を決める

## 🎓 学習の進め方

1. **基本のStackを理解**（S3Stack）
2. **リソース間の関係を学ぶ**（Lambda + API Gateway）
3. **Stack間の連携を実践**（VPC + App）
4. **設定の受け渡しをマスター**（Props）

Stack は CDK の基本中の基本です。しっかり理解して、AWS インフラをコードで管理しましょう！