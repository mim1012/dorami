#!/bin/bash
# Build and push RTMP Docker image to ECR
# Usage: ./build-and-push-image.sh <environment> <aws-region>

set -e

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-northeast-2}
IMAGE_NAME="live-commerce-rtmp"
DOCKERFILE_PATH="../docker/nginx-rtmp"

echo "================================"
echo "Building and pushing RTMP image"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo "AWS Region: $AWS_REGION"
echo ""

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $AWS_ACCOUNT_ID"

# ECR repository name
ECR_REPO_NAME="${IMAGE_NAME}-${ENVIRONMENT}"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "ECR Repository: $ECR_URI"
echo ""

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build Docker image
echo "Building Docker image..."
cd $DOCKERFILE_PATH
docker build -t "${IMAGE_NAME}:latest" -t "${IMAGE_NAME}:${ENVIRONMENT}" .
cd -

# Tag image for ECR
echo "Tagging image..."
docker tag "${IMAGE_NAME}:latest" "${ECR_URI}:latest"
docker tag "${IMAGE_NAME}:latest" "${ECR_URI}:$(date +%Y%m%d-%H%M%S)"

# Push to ECR
echo "Pushing image to ECR..."
docker push "${ECR_URI}:latest"
docker push "${ECR_URI}:$(date +%Y%m%d-%H%M%S)"

echo ""
echo "================================"
echo "Image pushed successfully!"
echo "================================"
echo "ECR URI: ${ECR_URI}:latest"
echo ""
echo "Next steps:"
echo "1. Deploy ECS service: cd ../aws-cdk && npm run deploy:${ENVIRONMENT}"
echo "2. Update ECS service to use new image: aws ecs update-service --cluster <cluster-name> --service rtmp-service-${ENVIRONMENT} --force-new-deployment"
