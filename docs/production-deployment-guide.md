# Dorami 프로덕션 배포 가이드

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [서버 준비](#2-서버-준비)
3. [환경 설정](#3-환경-설정)
4. [SSL 인증서 설정](#4-ssl-인증서-설정)
5. [첫 배포](#5-첫-배포)
6. [CI/CD 자동 배포](#6-cicd-자동-배포)
7. [모니터링](#7-모니터링)
8. [백업 및 복구](#8-백업-및-복구)
9. [롤백](#9-롤백)
10. [문제 해결](#10-문제-해결)
11. [보안 체크리스트](#11-보안-체크리스트)

---

## 1. 사전 요구사항

### 서버 사양 (최소)

| 항목 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### 필수 소프트웨어

```bash
# Docker 24.0+
docker --version

# Docker Compose 2.20+
docker compose version

# Git
git --version

# OpenSSL (시크릿 생성용)
openssl version
```

### 도메인 및 DNS

- 프로덕션 도메인 확보 (예: `your-domain.com`)
- DNS A 레코드 설정 (서버 IP 연결)
- 서브도메인 설정 (선택: `www`, `api`, `cdn`)

---

## 2. 서버 준비

### 2.1 Docker 설치

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 재로그인 후 확인
docker run hello-world
```

### 2.2 방화벽 설정

```bash
# UFW 설치 및 활성화
sudo apt install ufw -y

# 필수 포트 허용
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 1935/tcp  # RTMP (라이브 스트리밍)

# 방화벽 활성화
sudo ufw enable
sudo ufw status
```

### 2.3 프로젝트 클론

```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /opt/dorami
sudo chown $USER:$USER /opt/dorami

# 프로젝트 클론
cd /opt/dorami
git clone https://github.com/your-org/dorami.git .
git checkout main
```

---

## 3. 환경 설정

### 3.1 환경 변수 파일 생성

```bash
# 프로덕션 환경 파일 생성
cp .env.production.example .env.production

# 편집
nano .env.production
```

### 3.2 필수 시크릿 생성

```bash
# JWT 시크릿 (64자 이상)
openssl rand -base64 64

# 암호화 키 (64 hex 문자)
openssl rand -hex 32

# PostgreSQL 비밀번호
openssl rand -base64 32

# Redis 비밀번호
openssl rand -base64 32
```

### 3.3 환경 변수 설정 예시

```env
# .env.production
NODE_ENV=production
DOMAIN=your-domain.com

# URLs
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Database
POSTGRES_USER=dorami_prod
POSTGRES_PASSWORD=<generated-password>
POSTGRES_DB=dorami_production

# Redis
REDIS_PASSWORD=<generated-password>

# JWT (64+ chars)
JWT_SECRET=<generated-jwt-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption (64 hex chars)
PROFILE_ENCRYPTION_KEY=<generated-hex-key>

# Kakao OAuth
KAKAO_CLIENT_ID=your_client_id
KAKAO_CLIENT_SECRET=your_client_secret
KAKAO_CALLBACK_URL=https://your-domain.com/api/v1/auth/kakao/callback

# Frontend
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_WS_URL=https://your-domain.com
NEXT_PUBLIC_CDN_URL=https://your-domain.com/hls

# Sentry (권장)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 4. SSL 인증서 설정

### 4.1 Let's Encrypt 인증서 발급

```bash
# 디렉토리 생성
mkdir -p infrastructure/docker/certbot/conf
mkdir -p infrastructure/docker/certbot/www

# nginx 설정에서 도메인 변경
sed -i 's/\${DOMAIN}/your-domain.com/g' infrastructure/docker/nginx-proxy/nginx.prod.conf

# 임시 HTTP 서버로 인증서 발급
docker run -it --rm \
  -v $(pwd)/infrastructure/docker/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/infrastructure/docker/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email admin@your-domain.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com \
  -d www.your-domain.com
```

### 4.2 인증서 확인

```bash
ls -la infrastructure/docker/certbot/conf/live/your-domain.com/
# fullchain.pem, privkey.pem 파일 존재 확인
```

---

## 5. 첫 배포

### 5.1 Docker 이미지 빌드

```bash
cd /opt/dorami

# 이미지 빌드
docker compose -f docker-compose.prod.yml build

# 빌드 확인
docker images | grep dorami
```

### 5.2 데이터베이스 마이그레이션

```bash
# 데이터베이스 컨테이너만 먼저 시작
docker compose -f docker-compose.prod.yml up -d postgres

# 헬스체크 대기
sleep 10

# 마이그레이션 실행
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# (선택) 시드 데이터
docker compose -f docker-compose.prod.yml run --rm backend npx prisma db seed
```

### 5.3 전체 서비스 시작

```bash
# 모든 서비스 시작
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 상태 확인
docker compose -f docker-compose.prod.yml ps

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f
```

### 5.4 헬스 체크

```bash
# Backend API
curl -f https://your-domain.com/api/health

# Frontend
curl -f https://your-domain.com

# RTMP 서버
curl -f http://localhost:8080/health
```

---

## 6. CI/CD 자동 배포

### 6.1 GitHub Secrets 설정

GitHub 저장소 > Settings > Secrets and variables > Actions에서 설정:

| Secret Name | Description |
|-------------|-------------|
| `PRODUCTION_HOST` | 프로덕션 서버 IP/호스트 |
| `PRODUCTION_USER` | SSH 사용자명 |
| `PRODUCTION_SSH_KEY` | SSH 개인키 |
| `PRODUCTION_URL` | `https://your-domain.com` |
| `PRODUCTION_API_URL` | `https://your-domain.com/api` |
| `PRODUCTION_WS_URL` | `https://your-domain.com` |
| `PRODUCTION_CDN_URL` | `https://your-domain.com/hls` |
| `SENTRY_DSN` | Sentry DSN |
| `SENTRY_AUTH_TOKEN` | Sentry Auth Token |
| `SENTRY_ORG` | Sentry Organization |
| `SENTRY_PROJECT` | Sentry Project |

### 6.2 GitHub Environments 설정

1. `production-approval` 환경 생성
   - Required reviewers 설정 (배포 승인자)

2. `production` 환경 생성
   - Deployment branches: `main` 또는 태그만

### 6.3 릴리스 배포

```bash
# 버전 태그 생성
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# GitHub에서 Release 생성 → 자동 배포 트리거
```

### 6.4 수동 배포

GitHub Actions > Deploy to Production > Run workflow

---

## 7. 모니터링

### 7.1 Docker 상태 모니터링

```bash
# 컨테이너 상태
docker compose -f docker-compose.prod.yml ps

# 리소스 사용량
docker stats

# 로그 실시간 확인
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

### 7.2 서비스별 로그

```bash
# Backend 로그
docker compose -f docker-compose.prod.yml logs -f backend

# Frontend 로그
docker compose -f docker-compose.prod.yml logs -f frontend

# Nginx 로그
docker compose -f docker-compose.prod.yml logs -f nginx-proxy

# 데이터베이스 로그
docker compose -f docker-compose.prod.yml logs -f postgres
```

### 7.3 시스템 리소스

```bash
# 디스크 사용량
df -h

# 메모리 사용량
free -m

# CPU 사용량
top -bn1 | head -20
```

### 7.4 Sentry 에러 추적

프로덕션 에러는 Sentry 대시보드에서 실시간 모니터링:
- https://sentry.io/organizations/your-org/

---

## 8. 백업 및 복구

### 8.1 자동 백업 스크립트

```bash
# 백업 스크립트 생성
cat > /opt/dorami/scripts/backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/opt/dorami/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# 데이터베이스 백업
docker compose -f /opt/dorami/docker-compose.prod.yml exec -T postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Redis 백업 (선택)
docker compose -f /opt/dorami/docker-compose.prod.yml exec -T redis \
  redis-cli -a $REDIS_PASSWORD BGSAVE

# 오래된 백업 삭제
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: db_$TIMESTAMP.sql.gz"
EOF

chmod +x /opt/dorami/scripts/backup.sh
```

### 8.2 Cron 스케줄 설정

```bash
# 매일 새벽 3시 백업
crontab -e

# 추가:
0 3 * * * /opt/dorami/scripts/backup.sh >> /var/log/dorami-backup.log 2>&1
```

### 8.3 복구 절차

```bash
# 1. 서비스 중지
docker compose -f docker-compose.prod.yml stop backend frontend

# 2. 데이터베이스 복구
gunzip -c backups/db_20240101_030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U $POSTGRES_USER $POSTGRES_DB

# 3. 서비스 재시작
docker compose -f docker-compose.prod.yml up -d
```

---

## 9. 롤백

### 9.1 수동 롤백

```bash
cd /opt/dorami

# 이전 버전으로 체크아웃
git fetch --tags
git checkout v1.0.0  # 원하는 버전

# 이미지 다시 빌드
docker compose -f docker-compose.prod.yml build

# 서비스 재시작
docker compose -f docker-compose.prod.yml up -d
```

### 9.2 CI/CD 롤백

GitHub Actions > Deploy to Production > Run workflow
- version: 롤백할 버전 (예: `v1.0.0`)
- rollback: `true` 체크

### 9.3 긴급 롤백 (데이터베이스 포함)

```bash
# 1. 서비스 중지
docker compose -f docker-compose.prod.yml down

# 2. 데이터베이스 복구
gunzip -c backups/db_before_deployment.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U $POSTGRES_USER $POSTGRES_DB

# 3. 이전 버전 배포
git checkout v0.9.0
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 10. 문제 해결

### 10.1 서비스가 시작되지 않음

```bash
# 로그 확인
docker compose -f docker-compose.prod.yml logs backend

# 컨테이너 상태 확인
docker compose -f docker-compose.prod.yml ps -a

# 환경 변수 확인
docker compose -f docker-compose.prod.yml config
```

### 10.2 데이터베이스 연결 오류

```bash
# PostgreSQL 상태 확인
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# 연결 테스트
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1"
```

### 10.3 메모리 부족

```bash
# 메모리 상태 확인
free -m

# Docker 정리
docker system prune -af
docker volume prune -f

# 불필요한 이미지 삭제
docker image prune -af
```

### 10.4 SSL 인증서 갱신 실패

```bash
# 수동 갱신
docker compose -f docker-compose.prod.yml exec certbot \
  certbot renew --dry-run

# 강제 갱신
docker compose -f docker-compose.prod.yml exec certbot \
  certbot renew --force-renewal

# Nginx 재시작
docker compose -f docker-compose.prod.yml restart nginx-proxy
```

### 10.5 라이브 스트리밍 문제

```bash
# RTMP 서버 상태
docker compose -f docker-compose.prod.yml logs nginx-rtmp

# HLS 파일 확인
docker compose -f docker-compose.prod.yml exec nginx-rtmp ls -la /tmp/hls/

# RTMP 포트 확인
netstat -tlnp | grep 1935
```

---

## 11. 보안 체크리스트

### 배포 전 확인사항

- [ ] `.env.production` 파일이 Git에 추가되지 않음
- [ ] 모든 시크릿이 강력한 랜덤 값으로 설정됨
- [ ] JWT_SECRET이 64자 이상
- [ ] PROFILE_ENCRYPTION_KEY가 64 hex 문자
- [ ] CORS_ORIGINS가 정확한 도메인만 포함
- [ ] SSL 인증서가 유효함
- [ ] 방화벽 규칙이 올바르게 설정됨
- [ ] 데이터베이스 포트(5432)가 외부에 노출되지 않음
- [ ] Redis 포트(6379)가 외부에 노출되지 않음
- [ ] 로그에 민감 정보가 포함되지 않음

### 주기적 확인사항

- [ ] SSL 인증서 만료일 확인 (90일마다)
- [ ] 백업 정상 동작 확인 (매주)
- [ ] Docker 이미지 보안 스캔 (매월)
- [ ] 의존성 취약점 점검 (매월)
- [ ] 로그 검토 및 이상 징후 확인 (매일)

---

## 참고 명령어 요약

```bash
# 서비스 시작
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 서비스 중지
docker compose -f docker-compose.prod.yml down

# 서비스 재시작
docker compose -f docker-compose.prod.yml restart

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f

# 상태 확인
docker compose -f docker-compose.prod.yml ps

# 이미지 업데이트
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 전체 정리
docker compose -f docker-compose.prod.yml down -v --rmi all
```

---

## 지원

문제 발생 시:
1. 로그 확인: `docker compose -f docker-compose.prod.yml logs`
2. GitHub Issues: https://github.com/your-org/dorami/issues
3. Sentry 대시보드 확인
