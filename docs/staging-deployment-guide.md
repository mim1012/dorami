# Staging 배포 가이드

## 1. 사전 요구사항

### 서버 요구사항
- **OS**: Ubuntu 22.04 LTS (권장)
- **CPU**: 2 vCPU 이상
- **RAM**: 4GB 이상
- **Storage**: 20GB 이상
- **인스턴스 타입**: AWS t3.medium 권장

### 필수 소프트웨어
```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 재로그인 (docker 그룹 적용)
exit
# SSH 재접속
```

### 보안 그룹 (AWS)
| 포트 | 프로토콜 | 용도 |
|------|---------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 1935 | TCP | RTMP (OBS) |
| 3000 | TCP | Frontend (개발용) |
| 3001 | TCP | Backend API (개발용) |
| 8080 | TCP | HLS Streaming (개발용) |

---

## 2. 빠른 시작

### Step 1: 프로젝트 클론
```bash
git clone https://github.com/your-org/dorami.git
cd dorami
```

### Step 2: 환경변수 설정
```bash
# 환경변수 파일 복사
cp .env.staging.example .env.staging

# 환경변수 수정
nano .env.staging
```

**필수 설정:**
```bash
# 비밀번호 (강력한 값으로 변경)
POSTGRES_PASSWORD=your_secure_db_password
REDIS_PASSWORD=your_secure_redis_password

# JWT Secret (생성: openssl rand -base64 32)
JWT_SECRET=your_32_char_jwt_secret_here

# 암호화 키 (생성: openssl rand -hex 32)
PROFILE_ENCRYPTION_KEY=your_64_char_hex_key_here

# 도메인 (SSL 사용 시)
DOMAIN=staging.yourdomain.com
FRONTEND_URL=https://staging.yourdomain.com
```

### Step 3: 빌드 및 실행
```bash
# 실행 권한 부여
chmod +x scripts/deploy-staging.sh

# 이미지 빌드
./scripts/deploy-staging.sh build

# 서비스 시작
./scripts/deploy-staging.sh up

# 상태 확인
./scripts/deploy-staging.sh status
```

### Step 4: 데이터베이스 초기화
```bash
# 마이그레이션 실행
./scripts/deploy-staging.sh db-migrate

# (선택) 시드 데이터 삽입
./scripts/deploy-staging.sh db-seed
```

### Step 5: 접속 확인
```
Frontend: http://your-server-ip:3000
Backend API: http://your-server-ip:3001/api
HLS Stream: http://your-server-ip:8080/hls/
RTMP (OBS): rtmp://your-server-ip:1935/live
```

---

## 3. SSL 설정 (Let's Encrypt)

### 도메인 연결
```bash
# DNS A 레코드 설정
staging.yourdomain.com → EC2 Public IP
```

### SSL 인증서 발급
```bash
# nginx-proxy 포함 시작
./scripts/deploy-staging.sh ssl-init

# 또는 수동
docker-compose -f docker-compose.staging.yml --profile with-proxy up -d
```

### Nginx HTTPS 설정
1. `infrastructure/docker/nginx-proxy/conf.d/default.conf` 수정
2. HTTPS 서버 블록 주석 해제
3. HTTP → HTTPS 리다이렉트 활성화

```bash
# 서비스 재시작
./scripts/deploy-staging.sh restart
```

---

## 4. 배포 스크립트 명령어

```bash
./scripts/deploy-staging.sh [command]

# 사용 가능한 명령어:
build       # Docker 이미지 빌드
up          # 서비스 시작
down        # 서비스 중지
restart     # 서비스 재시작
logs        # 로그 확인 (실시간)
status      # 서비스 상태 확인
db-migrate  # DB 마이그레이션
db-seed     # DB 시드 데이터
ssl-init    # SSL 인증서 발급
ssl-renew   # SSL 인증서 갱신
cleanup     # 전체 삭제 (주의!)
```

---

## 5. 라이브 스트리밍 테스트

### OBS 설정
1. **설정 → 방송**
   - 서비스: 사용자 지정
   - 서버: `rtmp://your-server-ip:1935/live`
   - 스트림 키: (관리자 페이지에서 발급)

2. **설정 → 출력**
   - 비트레이트: 2500 Kbps
   - 키프레임 간격: 2초

3. **방송 시작** 클릭

### 시청
```
브라우저: http://your-server-ip:3000/live/{streamKey}
```

---

## 6. 모니터링

### 로그 확인
```bash
# 전체 로그
./scripts/deploy-staging.sh logs

# 특정 서비스 로그
docker logs -f dorami-backend
docker logs -f dorami-frontend
docker logs -f dorami-rtmp
```

### 리소스 사용량
```bash
docker stats
```

### 헬스체크
```bash
# Backend
curl http://localhost:3001/api/health

# Frontend
curl http://localhost:3000

# RTMP
curl http://localhost:8080/health
```

---

## 7. 문제 해결

### 컨테이너 시작 실패
```bash
# 로그 확인
docker logs dorami-backend
docker logs dorami-frontend

# 재빌드
./scripts/deploy-staging.sh build
./scripts/deploy-staging.sh restart
```

### 데이터베이스 연결 실패
```bash
# PostgreSQL 상태 확인
docker exec -it dorami-postgres psql -U dorami -d dorami -c '\dt'

# Redis 상태 확인
docker exec -it dorami-redis redis-cli ping
```

### RTMP 스트리밍 실패
```bash
# RTMP 로그 확인
docker logs dorami-rtmp

# HLS 파일 확인
docker exec -it dorami-rtmp ls -la /tmp/hls/
```

### 포트 충돌
```bash
# 사용 중인 포트 확인
sudo netstat -tlnp | grep -E ':(3000|3001|1935|8080)'

# 프로세스 종료
sudo kill -9 <PID>
```

---

## 8. 백업 및 복구

### 데이터베이스 백업
```bash
# 백업
docker exec dorami-postgres pg_dump -U dorami dorami > backup_$(date +%Y%m%d).sql

# 복구
cat backup_20240101.sql | docker exec -i dorami-postgres psql -U dorami dorami
```

### 볼륨 백업
```bash
# 볼륨 위치 확인
docker volume inspect dorami_postgres_data

# tar로 백업
sudo tar -czvf postgres_backup.tar.gz /var/lib/docker/volumes/dorami_postgres_data
```

---

## 9. 업데이트 배포

```bash
# 코드 업데이트
git pull origin main

# 재빌드 및 재시작
./scripts/deploy-staging.sh build
./scripts/deploy-staging.sh restart

# 마이그레이션 (필요시)
./scripts/deploy-staging.sh db-migrate
```

---

## 10. 비용 예상 (AWS)

| 서비스 | 사양 | 월 비용 |
|--------|------|--------|
| EC2 | t3.medium (2 vCPU, 4GB) | ~$30 |
| EBS | 20GB gp3 | ~$2 |
| 데이터 전송 | ~100GB/월 | ~$9 |
| **합계** | | **~$41/월** |

> 💡 **Tip**: Reserved Instance 또는 Spot Instance로 비용 절감 가능

---

*마지막 업데이트: 2026-02-03*
