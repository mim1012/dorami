#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LiveCommerceStreamingStack } from '../lib/streaming-stack';

const app = new cdk.App();

// Development environment
new LiveCommerceStreamingStack(app, 'LiveCommerceStreamingStack-dev', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2', // Seoul
  },
  environment: 'dev',
  backendUrl: process.env.BACKEND_URL || 'https://api-dev.yourdomain.com',
  domainName: 'stream-dev.yourdomain.com',
  certificateArn: process.env.CERTIFICATE_ARN_DEV,
});

// Production environment
new LiveCommerceStreamingStack(app, 'LiveCommerceStreamingStack-prod', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
  },
  environment: 'prod',
  backendUrl: process.env.BACKEND_URL_PROD || 'https://api.yourdomain.com',
  domainName: 'stream.yourdomain.com',
  certificateArn: process.env.CERTIFICATE_ARN_PROD,
  desiredTaskCount: 2, // Higher availability for production
});

app.synth();
