#!/usr/bin/env node
// ↑ このシェバンは、このファイルをNode.jsで実行することを指定します

// TypeScript: importはファイルや外部ライブラリを読み込む機能です
import 'source-map-support/register'; // エラー時に元のTypeScriptコードの行番号を表示するためのライブラリ
import * as cdk from 'aws-cdk-lib';    // AWS CDKのメインライブラリを「cdk」という名前で使用
// 自分で作成したスタック（設計図）をインポート
import { S3Stack } from '../lib/s3-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { VpcStack } from '../lib/vpc-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { HelloWorldStack } from '../samples/01-hello-world-website/lib/hello-world-stack';

// TypeScript: constは定数（変更できない値）を宣言します
// new演算子でクラスのインスタンス（実体）を作成します
const app = new cdk.App();

// TypeScript: オブジェクトリテラル {} を使って設定を渡します
// env（environment）は環境設定を意味します
const commonEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT, // 環境変数からAWSアカウントIDを取得
  region: process.env.CDK_DEFAULT_REGION,   // 環境変数からAWSリージョンを取得
};

// 基本的なS3バケットのスタック
// TypeScript: newでクラスのコンストラクタを呼び出し、インスタンスを作成
new S3Stack(app, 'S3Stack', {
  env: commonEnv, // 上で定義した環境設定を使用
});

// Lambda関数のスタック
new LambdaStack(app, 'LambdaStack', {
  env: commonEnv,
});

// VPCのスタック
new VpcStack(app, 'VpcStack', {
  env: commonEnv,
});

// API Gatewayのスタック
new ApiGatewayStack(app, 'ApiGatewayStack', {
  env: commonEnv,
});

// Sample 01: Hello World Website
new HelloWorldStack(app, 'HelloWorldStack', {
  websiteName: 'my-first-site',
  environment: 'dev',
  env: commonEnv,
});

// TypeScript基本用語解説:
// - import: 他のファイルやライブラリの機能を読み込む
// - const: 変更できない変数（定数）
// - new: クラスから新しいオブジェクトを作成
// - env: 環境変数やデプロイ先の設定
// - process.env: Node.jsで環境変数にアクセスする方法