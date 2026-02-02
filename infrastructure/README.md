# Live Commerce Streaming Infrastructure

AWS infrastructure for Live Commerce RTMP streaming and HLS delivery using ECS Fargate, CloudFront CDN, and Network Load Balancer.

## 📋 Overview

This infrastructure deploys:

1. **Nginx RTMP Server** (ECS Fargate)
   - Receives RTMP streams from OBS
   - Transcodes to multi-bitrate HLS (720p, 480p, 360p)
   - Serves HLS segments via HTTP

2. **Network Load Balancer**
   - Handles RTMP ingestion (port 1935)
   - TCP load balancing for ECS tasks

3. **Application Load Balancer**
   - Serves HLS segments (port 8080)
   - Health checks for ECS tasks

4. **CloudFront CDN**
   - Global edge delivery of HLS streams
   - Low-latency caching (2s TTL for playlists)
   - CORS-enabled for web players

## 🏗️ Architecture

```
OBS Studio
    ↓ RTMP (port 1935)
Network Load Balancer
    ↓
ECS Fargate (Nginx RTMP + FFmpeg)
    ↓ HLS segments
Application Load Balancer
    ↓ HTTP origin
CloudFront CDN
    ↓ HTTPS
Web Player (React + HLS.js)
```

## 📦 Prerequisites

### Required Tools
- **AWS CLI**: `aws --version` (v2.x+)
- **Docker**: `docker --version` (v20.x+)
- **Node.js**: `node --version` (v20.x+)
- **AWS CDK**: `npm install -g aws-cdk`

### AWS Account Setup
1. AWS Account with administrative access
2. AWS CLI configured: `aws configure`
3. ECR repository access
4. Route53 hosted zone (optional, for custom domain)
5. ACM certificate (optional, for HTTPS on custom domain)

### Environment Variables
Create `.env` file in `aws-cdk/` directory:

```bash
# AWS Configuration
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=ap-northeast-2

# Development
BACKEND_URL=https://api-dev.yourdomain.com
CERTIFICATE_ARN_DEV=arn:aws:acm:us-east-1:123456789012:certificate/xxx

# Production
BACKEND_URL_PROD=https://api.yourdomain.com
CERTIFICATE_ARN_PROD=arn:aws:acm:us-east-1:123456789012:certificate/yyy
```

## 🚀 Deployment Guide

### Step 1: Local Testing (Docker Compose)

Test the RTMP server locally before deploying to AWS:

```bash
cd docker
docker-compose up -d

# Stream to local RTMP server with OBS:
# Server: rtmp://localhost/live
# Stream Key: test-stream-key

# View HLS stream:
# http://localhost:8080/hls/test-stream-key/master.m3u8
```

**Stop local environment:**
```bash
docker-compose down -v
```

### Step 2: Build and Push Docker Image

```bash
cd scripts
chmod +x build-and-push-image.sh
./build-and-push-image.sh dev ap-northeast-2
```

This script:
1. Builds the Nginx RTMP Docker image
2. Logs in to AWS ECR
3. Pushes image to ECR repository

### Step 3: Deploy AWS Infrastructure

```bash
cd aws-cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-2

# Synthesize CloudFormation template
npm run synth

# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

**Deployment takes ~10-15 minutes**

### Step 4: Configure Backend

Update backend `.env` with CDK outputs:

```bash
# From CDK output: RTMPServerURL
RTMP_SERVER_URL=rtmp://rtmp-nlb-dev-xxx.elb.ap-northeast-2.amazonaws.com/live

# From CDK output: CloudFrontURL
HLS_SERVER_URL=https://d1234abcd.cloudfront.net
```

Restart backend to apply changes:
```bash
cd ../../backend
npm run start:dev
```

### Step 5: Test End-to-End

#### 1. Generate Stream Key (Backend API)
```bash
curl -X POST http://localhost:3000/api/streaming/generate-key \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "streamKey": "abc123def456",
  "rtmpUrl": "rtmp://rtmp-nlb-dev-xxx.elb.ap-northeast-2.amazonaws.com/live",
  "streamUrl": "https://d1234abcd.cloudfront.net/hls/abc123def456/master.m3u8"
}
```

#### 2. Configure OBS Studio
- **Server**: `rtmp://rtmp-nlb-dev-xxx.elb.ap-northeast-2.amazonaws.com/live`
- **Stream Key**: `abc123def456`
- **Video Bitrate**: 2500 Kbps
- **Resolution**: 1280x720
- **Frame Rate**: 30 FPS
- **Encoder**: x264

#### 3. Start Streaming
Click "Start Streaming" in OBS

#### 4. Watch Stream
Open browser and navigate to:
```
http://localhost:3001/live/abc123def456
```

## 📊 Monitoring

### CloudWatch Metrics

Access CloudWatch console:
```bash
aws cloudwatch get-dashboard --dashboard-name live-commerce-streaming-dev
```

**Key Metrics:**
- **ECS CPU/Memory**: Task resource utilization
- **NLB Connections**: Active RTMP connections
- **ALB Requests**: HLS segment requests
- **CloudFront Requests**: CDN traffic

### CloudWatch Logs

View ECS task logs:
```bash
aws logs tail /ecs/live-commerce-rtmp-dev --follow
```

### ECS Exec (Debugging)

Connect to running ECS task:
```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster live-commerce-streaming-dev --query 'taskArns[0]' --output text)

# Execute bash
aws ecs execute-command \
  --cluster live-commerce-streaming-dev \
  --task $TASK_ARN \
  --container RTMPContainer \
  --interactive \
  --command "/bin/bash"
```

## 💰 Cost Estimation

### Monthly Costs (Development)

| Service | Configuration | Cost |
|---------|--------------|------|
| ECS Fargate | 2 vCPU, 4GB RAM, 1 task | ~$50 |
| Network Load Balancer | 1 NLB, 1 target | ~$20 |
| Application Load Balancer | 1 ALB, 1 target | ~$20 |
| CloudFront | ~1TB data transfer | ~$85 |
| CloudWatch Logs | 10GB/month | ~$5 |
| NAT Gateway | 1 NAT, ~50GB | ~$40 |
| **Total** | | **~$220/month** |

### Monthly Costs (Production, 2 tasks)

| Service | Configuration | Cost |
|---------|--------------|------|
| ECS Fargate | 2 vCPU, 4GB RAM, 2 tasks | ~$100 |
| Network Load Balancer | 1 NLB, 2 targets | ~$25 |
| Application Load Balancer | 1 ALB, 2 targets | ~$25 |
| CloudFront | ~5TB data transfer | ~$400 |
| CloudWatch Logs | 50GB/month | ~$25 |
| NAT Gateway | 2 NAT, ~200GB | ~$100 |
| **Total** | | **~$675/month** |

### Cost Optimization Tips

1. **Use Reserved Capacity**: Save 30-50% on ECS Fargate
2. **CloudFront Pricing Class**: Use `PRICE_CLASS_100` (US/EU only) to save 25%
3. **Auto-scaling**: Scale down during off-peak hours
4. **Compression**: Enable GZIP for playlists to reduce bandwidth
5. **Consider Alternatives**:
   - **AWS IVS**: ~$1.50/hour broadcast (simpler, managed)
   - **Mux.com**: ~$10-15/1000 minutes (fully managed)

## 🔧 Configuration

### Adjust ECS Task Resources

Edit `aws-cdk/lib/streaming-stack.ts`:

```typescript
const taskDefinition = new ecs.FargateTaskDefinition(this, 'RTMPTaskDefinition', {
  memoryLimitMiB: 8192,  // Increase to 8GB
  cpu: 4096,             // Increase to 4 vCPU
});
```

### Change HLS Segment Duration

Edit `docker/nginx-rtmp/rtmp.conf`:

```nginx
hls_fragment 1s;        # 1-second segments (lower latency)
hls_playlist_length 3s; # Keep 3 segments
```

### Enable Auto-scaling

Edit `aws-cdk/lib/streaming-stack.ts`:

```typescript
scaling.scaleOnCpuUtilization('CPUScaling', {
  targetUtilizationPercent: 60,  // Scale at 60% CPU
  scaleInCooldown: cdk.Duration.seconds(120),
  scaleOutCooldown: cdk.Duration.seconds(60),
});
```

## 🛠️ Troubleshooting

### Issue: OBS can't connect to RTMP server

**Solution:**
1. Check NLB security group allows port 1935
2. Verify ECS task is running: `aws ecs list-tasks --cluster live-commerce-streaming-dev`
3. Check ECS logs: `aws logs tail /ecs/live-commerce-rtmp-dev --follow`
4. Test RTMP endpoint: `ffprobe rtmp://NLB-DNS/live/test-key`

### Issue: HLS stream not playing

**Solution:**
1. Check ALB target health: AWS Console → EC2 → Target Groups
2. Verify HLS segments exist: `curl http://ALB-DNS/hls/STREAM-KEY/master.m3u8`
3. Check CORS headers: Open browser DevTools → Network tab
4. Verify CloudFront origin: AWS Console → CloudFront → Distributions

### Issue: High latency (>10 seconds)

**Solution:**
1. Reduce HLS segment duration to 1s
2. Check CloudFront cache TTL (should be 2s for .m3u8)
3. Enable LL-HLS (requires HLS.js v1.5+)
4. Verify ECS task is not CPU-throttled

### Issue: ECS task keeps restarting

**Solution:**
1. Check task logs: `aws logs tail /ecs/live-commerce-rtmp-dev --follow`
2. Verify health check endpoint: `curl http://TASK-IP:8080/health`
3. Increase health check grace period to 120s
4. Check memory usage: May need to increase task memory

## 🔒 Security

### Network Security

- ECS tasks run in **private subnets** (no public IPs)
- Security groups restrict access:
  - Port 1935 (RTMP): Only from NLB
  - Port 8080 (HTTP): Only from ALB
  - Outbound: Backend API + internet (for package updates)

### Stream Key Validation

Backend validates stream keys before allowing publish:

```typescript
// backend/src/modules/streaming/streaming.controller.ts
@Post('auth')
async authenticateRTMP(@Body() body: { name: string }) {
  const streamKey = body.name;
  const isValid = await this.streamingService.validateStreamKey(streamKey);

  if (!isValid) {
    throw new UnauthorizedException('Invalid stream key');
  }

  return { success: true };
}
```

### HTTPS Enforcement

CloudFront enforces HTTPS for all HLS requests:
```typescript
viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
```

## 📚 Additional Resources

- **Nginx RTMP Module**: https://github.com/arut/nginx-rtmp-module
- **FFmpeg HLS Guide**: https://trac.ffmpeg.org/wiki/Encode/H.264
- **AWS ECS Best Practices**: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
- **CloudFront for Video**: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/live-streaming.html
- **HLS.js Documentation**: https://github.com/video-dev/hls.js

## 🗑️ Cleanup

### Destroy AWS Resources

```bash
cd aws-cdk

# Destroy development
cdk destroy LiveCommerceStreamingStack-dev

# Destroy production
cdk destroy LiveCommerceStreamingStack-prod
```

**Warning**: This will delete all resources including logs and metrics.

### Delete ECR Images

```bash
aws ecr batch-delete-image \
  --repository-name live-commerce-rtmp-dev \
  --image-ids imageTag=latest
```

## 📞 Support

For infrastructure issues:
1. Check CloudWatch logs
2. Review ECS task status
3. Verify security group rules
4. Test with local Docker Compose first

## 📝 License

MIT License - See LICENSE file for details
