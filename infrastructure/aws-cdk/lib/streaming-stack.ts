import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface LiveCommerceStreamingStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod';
  backendUrl: string;
  domainName?: string;
  certificateArn?: string;
  desiredTaskCount?: number;
}

export class LiveCommerceStreamingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LiveCommerceStreamingStackProps) {
    super(scope, id, props);

    const { environment, backendUrl, domainName, certificateArn, desiredTaskCount = 1 } = props;

    // =========================================
    // 1. VPC Configuration
    // =========================================
    const vpc = new ec2.Vpc(this, 'StreamingVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // =========================================
    // 2. ECR Repository for RTMP Server
    // =========================================
    const ecrRepository = new ecr.Repository(this, 'RTMPServerRepository', {
      repositoryName: `live-commerce-rtmp-${environment}`,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // =========================================
    // 3. ECS Cluster
    // =========================================
    const cluster = new ecs.Cluster(this, 'StreamingCluster', {
      vpc,
      clusterName: `live-commerce-streaming-${environment}`,
      containerInsights: true,
    });

    // =========================================
    // 4. Task Definition for RTMP Server
    // =========================================
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'RTMPTaskDefinition', {
      memoryLimitMiB: 4096,
      cpu: 2048,
      family: `live-commerce-rtmp-${environment}`,
    });

    // CloudWatch Logs
    const logGroup = new logs.LogGroup(this, 'RTMPLogGroup', {
      logGroupName: `/ecs/live-commerce-rtmp-${environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container Definition
    const container = taskDefinition.addContainer('RTMPContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'rtmp',
        logGroup,
      }),
      environment: {
        BACKEND_URL: backendUrl,
        MAX_CONNECTIONS: '1000',
        HLS_FRAGMENT_LENGTH: '2s',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(40),
      },
    });

    // Port mappings
    container.addPortMappings(
      {
        containerPort: 1935,
        protocol: ecs.Protocol.TCP,
        name: 'rtmp',
      },
      {
        containerPort: 8080,
        protocol: ecs.Protocol.TCP,
        name: 'http',
      }
    );

    // =========================================
    // 5. Network Load Balancer for RTMP (Port 1935)
    // =========================================
    const rtmpNlb = new elbv2.NetworkLoadBalancer(this, 'RTMPNLB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `rtmp-nlb-${environment}`,
    });

    const rtmpListener = rtmpNlb.addListener('RTMPListener', {
      port: 1935,
      protocol: elbv2.Protocol.TCP,
    });

    // =========================================
    // 6. Application Load Balancer for HLS (Port 8080)
    // =========================================
    const hlsAlb = new elbv2.ApplicationLoadBalancer(this, 'HLSALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `hls-alb-${environment}`,
    });

    const hlsListener = hlsAlb.addListener('HLSListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // =========================================
    // 7. ECS Service
    // =========================================
    const ecsService = new ecs.FargateService(this, 'RTMPService', {
      cluster,
      taskDefinition,
      serviceName: `rtmp-service-${environment}`,
      desiredCount: desiredTaskCount,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      enableExecuteCommand: true, // For debugging
    });

    // Auto-scaling
    const scaling = ecsService.autoScaleTaskCount({
      minCapacity: desiredTaskCount,
      maxCapacity: environment === 'prod' ? 4 : 2,
    });

    scaling.scaleOnCpuUtilization('CPUScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Attach to NLB (RTMP)
    rtmpListener.addTargets('RTMPTargets', {
      port: 1935,
      protocol: elbv2.Protocol.TCP,
      targets: [ecsService],
      healthCheck: {
        enabled: true,
        protocol: elbv2.Protocol.HTTP,
        port: '8080',
        path: '/health',
        interval: cdk.Duration.seconds(30),
      },
    });

    // Attach to ALB (HLS)
    hlsListener.addTargets('HLSTargets', {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [ecsService],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: '200',
      },
    });

    // =========================================
    // 8. CloudFront Distribution for HLS
    // =========================================
    const distribution = new cloudfront.Distribution(this, 'HLSDistribution', {
      comment: `Live Commerce HLS CDN - ${environment}`,
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(hlsAlb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'HLSCachePolicy', {
          cachePolicyName: `hls-cache-policy-${environment}`,
          comment: 'Cache policy for LL-HLS streaming',
          defaultTtl: cdk.Duration.seconds(2),
          minTtl: cdk.Duration.seconds(0),
          maxTtl: cdk.Duration.seconds(60),
          headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
            'Origin',
            'Access-Control-Request-Method',
            'Access-Control-Request-Headers'
          ),
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }),
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'HLSResponseHeadersPolicy', {
          responseHeadersPolicyName: `hls-headers-${environment}`,
          corsBehavior: {
            accessControlAllowOrigins: ['*'],
            accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
            accessControlAllowHeaders: ['*'],
            accessControlExposeHeaders: ['Content-Length', 'Content-Range'],
            accessControlMaxAge: cdk.Duration.seconds(600),
            originOverride: true,
          },
        }),
      },
      additionalBehaviors: {
        '*.m3u8': {
          origin: new origins.LoadBalancerV2Origin(hlsAlb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'M3U8CachePolicy', {
            cachePolicyName: `m3u8-cache-policy-${environment}`,
            defaultTtl: cdk.Duration.seconds(2),
            minTtl: cdk.Duration.seconds(0),
            maxTtl: cdk.Duration.seconds(10),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
        },
        '*.ts': {
          origin: new origins.LoadBalancerV2Origin(hlsAlb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'TSCachePolicy', {
            cachePolicyName: `ts-cache-policy-${environment}`,
            defaultTtl: cdk.Duration.seconds(60),
            minTtl: cdk.Duration.seconds(30),
            maxTtl: cdk.Duration.seconds(3600),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // US, Europe, Asia
    });

    // =========================================
    // 9. Outputs
    // =========================================
    new cdk.CfnOutput(this, 'RTMPServerURL', {
      value: `rtmp://${rtmpNlb.loadBalancerDnsName}/live`,
      description: 'RTMP Server URL for OBS streaming',
      exportName: `RTMPServerURL-${environment}`,
    });

    new cdk.CfnOutput(this, 'HLSOriginURL', {
      value: `http://${hlsAlb.loadBalancerDnsName}/hls`,
      description: 'HLS Origin URL (ALB)',
      exportName: `HLSOriginURL-${environment}`,
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront CDN URL for HLS playback',
      exportName: `CloudFrontURL-${environment}`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: ecrRepository.repositoryUri,
      description: 'ECR Repository URI for RTMP Docker image',
      exportName: `ECRRepositoryURI-${environment}`,
    });

    new cdk.CfnOutput(this, 'ECSClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `ECSClusterName-${environment}`,
    });
  }
}
