# AWS 인프라 설정 가이드

**프로젝트**: Dorami Live Commerce
**작성일**: 2026-02-05

---

## 📋 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [비용 예상](#비용-예상)
3. [단계별 설정](#단계별-설정)
4. [인프라 코드 (Terraform)](#인프라-코드)

---

## 🏗️ 아키텍처 개요

```
[사용자] → [CloudFront] → [S3 (Frontend)]
                ↓
           [Route 53]
                ↓
        [Application Load Balancer]
                ↓
         [ECS Fargate (Backend)]
            ↙       ↘
    [RDS PostgreSQL]  [ElastiCache Redis]
            ↓
    [Secrets Manager]
```

---

## 💰 비용 예상

### Staging 환경 (월간)

| 서비스              | 스펙           | 월 비용    |
| ------------------- | -------------- | ---------- |
| RDS (PostgreSQL)    | db.t3.micro    | $15        |
| ElastiCache (Redis) | cache.t3.micro | $12        |
| ECS Fargate         | 0.5 vCPU, 1GB  | $25        |
| ALB                 | -              | $20        |
| S3 + CloudFront     | 10GB           | $5         |
| **합계**            |                | **$77/월** |

### Production 환경 (월간)

| 서비스                      | 스펙                 | 월 비용     |
| --------------------------- | -------------------- | ----------- |
| RDS (PostgreSQL Multi-AZ)   | db.t3.small          | $80         |
| ElastiCache (Redis Replica) | cache.t3.small       | $50         |
| ECS Fargate (2 tasks)       | 1 vCPU, 2GB x2       | $100        |
| ALB                         | -                    | $25         |
| S3 + CloudFront             | 50GB, 100GB transfer | $20         |
| Secrets Manager             | 10 secrets           | $4          |
| CloudWatch Logs             | 10GB                 | $5          |
| **합계**                    |                      | **$284/월** |

**총 월간 비용**: ~$361/월 (Staging + Production)

---

## 🚀 단계별 설정

### Step 1: VPC 및 네트워크 설정

```bash
# AWS CLI 설정
aws configure

# VPC 생성
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=dorami-vpc}]'

# Public Subnet 생성 (AZ a)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-northeast-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dorami-public-1a}]'

# Public Subnet 생성 (AZ b)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-northeast-2b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dorami-public-1b}]'

# Private Subnet 생성 (AZ a)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ap-northeast-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dorami-private-1a}]'

# Private Subnet 생성 (AZ b)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.12.0/24 \
  --availability-zone ap-northeast-2b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dorami-private-1b}]'

# Internet Gateway 생성 및 연결
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=dorami-igw}]'

aws ec2 attach-internet-gateway \
  --internet-gateway-id igw-xxxxx \
  --vpc-id vpc-xxxxx
```

---

### Step 2: RDS PostgreSQL 설정

**Staging**:

```bash
aws rds create-db-instance \
  --db-instance-identifier dorami-staging \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username postgres \
  --master-user-password 'CHANGE_ME_STRONG_PASSWORD' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name dorami-db-subnet \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --no-publicly-accessible \
  --tags Key=Environment,Value=staging
```

**Production** (Multi-AZ):

```bash
aws rds create-db-instance \
  --db-instance-identifier dorami-production \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 16.1 \
  --master-username postgres \
  --master-user-password 'CHANGE_ME_STRONG_PASSWORD' \
  --allocated-storage 50 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name dorami-db-subnet \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --multi-az \
  --storage-encrypted \
  --no-publicly-accessible \
  --tags Key=Environment,Value=production
```

---

### Step 3: ElastiCache Redis 설정

**Staging**:

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id dorami-staging \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name dorami-redis-subnet \
  --security-group-ids sg-xxxxx \
  --tags Key=Environment,Value=staging
```

**Production** (with Replica):

```bash
aws elasticache create-replication-group \
  --replication-group-id dorami-production \
  --replication-group-description "Dorami Production Redis" \
  --cache-node-type cache.t3.small \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --cache-subnet-group-name dorami-redis-subnet \
  --security-group-ids sg-xxxxx \
  --tags Key=Environment,Value=production
```

---

### Step 4: ECR 리포지토리 생성

```bash
# Backend 이미지 리포지토리
aws ecr create-repository \
  --repository-name dorami-backend \
  --image-scanning-configuration scanOnPush=true \
  --region ap-northeast-2

# 출력된 repositoryUri 저장
# 예: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/dorami-backend
```

---

### Step 5: ECS 클러스터 및 태스크 정의

**클러스터 생성**:

```bash
aws ecs create-cluster \
  --cluster-name dorami-staging \
  --capacity-providers FARGATE FARGATE_SPOT \
  --region ap-northeast-2
```

**태스크 정의** (task-definition.json):

```json
{
  "family": "dorami-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/dorami-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:ACCOUNT_ID:secret:dorami/staging/backend:DATABASE_URL::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dorami-backend-staging",
          "awslogs-region": "ap-northeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

```bash
# 태스크 정의 등록
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

---

### Step 6: Application Load Balancer 설정

```bash
# ALB 생성
aws elbv2 create-load-balancer \
  --name dorami-alb-staging \
  --subnets subnet-public-1a subnet-public-1b \
  --security-groups sg-xxxxx \
  --scheme internet-facing \
  --type application

# 대상 그룹 생성
aws elbv2 create-target-group \
  --name dorami-backend-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxxxx \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3

# 리스너 생성
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

---

### Step 7: ECS 서비스 생성

```bash
aws ecs create-service \
  --cluster dorami-staging \
  --service-name dorami-backend-service \
  --task-definition dorami-backend:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-1a,subnet-private-1b],securityGroups=[sg-xxxxx],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=3001 \
  --health-check-grace-period-seconds 60
```

---

### Step 8: S3 + CloudFront 설정

**S3 버킷 생성**:

```bash
# Staging
aws s3 mb s3://dorami-staging-frontend --region ap-northeast-2

# 정적 웹사이트 호스팅 활성화
aws s3 website s3://dorami-staging-frontend \
  --index-document index.html \
  --error-document 404.html

# 버킷 정책 설정 (CloudFront만 접근)
aws s3api put-bucket-policy \
  --bucket dorami-staging-frontend \
  --policy file://bucket-policy.json
```

**CloudFront 배포 생성**:

```bash
aws cloudfront create-distribution --cli-input-json file://cloudfront-config.json
```

---

### Step 9: Secrets Manager 설정

```bash
# Production secrets 생성
aws secretsmanager create-secret \
  --name dorami/production/backend \
  --description "Backend environment variables for production" \
  --secret-string file://production-secrets.json \
  --region ap-northeast-2
```

**production-secrets.json 예시**:

```json
{
  "DATABASE_URL": "postgresql://postgres:PASSWORD@dorami-prod.xxxxx.ap-northeast-2.rds.amazonaws.com:5432/live_commerce",
  "REDIS_URL": "redis://dorami-prod.xxxxx.apne2.cache.amazonaws.com:6379",
  "JWT_SECRET": "your-jwt-secret-64-chars",
  "ENCRYPTION_KEY": "your-encryption-key-32-chars"
}
```

---

### Step 10: CloudWatch 모니터링 설정

```bash
# Log Group 생성
aws logs create-log-group \
  --log-group-name /ecs/dorami-backend-staging \
  --region ap-northeast-2

# 알람 생성 (CPU 사용률 > 80%)
aws cloudwatch put-metric-alarm \
  --alarm-name dorami-backend-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ServiceName,Value=dorami-backend-service Name=ClusterName,Value=dorami-staging \
  --alarm-actions arn:aws:sns:ap-northeast-2:ACCOUNT_ID:alerts
```

---

## 🛠️ 인프라 코드 (Terraform)

전체 인프라를 코드로 관리하려면 Terraform 사용을 권장합니다:

```hcl
# terraform/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "dorami-terraform-state"
    key    = "production/terraform.tfstate"
    region = "ap-northeast-2"
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "dorami-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-northeast-2a", "ap-northeast-2b"]
  private_subnets = ["10.0.11.0/24", "10.0.12.0/24"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = false

  tags = {
    Environment = "production"
    Project     = "dorami"
  }
}

# RDS
module "rds" {
  source = "terraform-aws-modules/rds/aws"

  identifier = "dorami-production"

  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = "db.t3.small"
  allocated_storage = 50
  storage_type      = "gp3"

  db_name  = "live_commerce"
  username = "postgres"
  password = var.db_password # 변수로 관리

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  tags = {
    Environment = "production"
  }
}
```

사용법:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

---

## 🔐 보안 그룹 규칙

### ALB Security Group

- Inbound: 80 (HTTP), 443 (HTTPS) from 0.0.0.0/0
- Outbound: All to ECS tasks

### ECS Tasks Security Group

- Inbound: 3001 from ALB
- Outbound: 5432 (RDS), 6379 (Redis)

### RDS Security Group

- Inbound: 5432 from ECS tasks
- Outbound: None

### ElastiCache Security Group

- Inbound: 6379 from ECS tasks
- Outbound: None

---

## 📝 다음 단계

1. AWS 계정 준비
2. IAM 사용자/역할 생성
3. Step 1부터 순차적으로 실행
4. 각 단계마다 검증
5. 배포 문서(DEPLOYMENT.md) 참고하여 배포

---

**작성자**: Claude (Sonnet 4.5)
**최종 업데이트**: 2026-02-05
