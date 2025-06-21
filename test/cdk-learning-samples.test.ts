import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as CdkLearningSamples from '../lib/s3-stack';

describe('CDK Learning Samples Test', () => {
  test('S3 Bucket Created', () => {
    const app = new cdk.App();
    
    // スタックを作成
    const stack = new CdkLearningSamples.S3Stack(app, 'MyTestStack');
    
    // テンプレートを生成
    const template = Template.fromStack(stack);

    // S3バケットが作成されていることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: {
        'Fn::Sub': 'basic-bucket-${AWS::AccountId}-${AWS::Region}'
      }
    });

    // 静的ウェブサイトホスティング用バケットが作成されていることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      WebsiteConfiguration: {
        IndexDocument: 'index.html',
        ErrorDocument: 'error.html'
      }
    });

    // バージョニング有効なバケットの確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    });

    // 暗号化されたバケットの確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }
        ]
      }
    });
  });

  test('Correct number of S3 buckets created', () => {
    const app = new cdk.App();
    const stack = new CdkLearningSamples.S3Stack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    // 5つのS3バケットが作成されていることを確認
    template.resourceCountIs('AWS::S3::Bucket', 5);
  });

  test('Outputs are created', () => {
    const app = new cdk.App();
    const stack = new CdkLearningSamples.S3Stack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    // 出力が存在することを確認
    template.hasOutput('BasicBucketName', {});
    template.hasOutput('WebsiteBucketUrl', {});
    template.hasOutput('VersionedBucketArn', {});
  });
});