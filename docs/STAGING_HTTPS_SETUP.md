# Staging HTTPS 설정 가이드

Staging 환경에서 Let's Encrypt SSL 인증서를 사용하여 HTTPS를 활성화합니다.

## 개요

- **설정 파일:** `nginx/staging-ssl.conf` (443 포트 + HTTP→HTTPS 리다이렉트)
- **인증서 경로:** `nginx/ssl/fullchain.pem`, `nginx/ssl/privkey.pem`
- **갱신:** Certbot 자동 갱신 설정

## 1단계: 사전 준비

### 1.1 도메인 설정

Staging용 도메인이 필요합니다. 예: `staging.doremi-live.com`

DNS A 레코드가 Staging 서버의 IP를 가리키도록 설정되어 있어야 합니다.

```bash
# Staging 서버에서 확인
nslookup staging.doremi-live.com
```

### 1.2 방화벽 설정

Staging 서버의 보안 그룹에서 다음 포트를 열어야 합니다:

- **80** (HTTP - ACME 챌린지용)
- **443** (HTTPS)

## 2단계: 초기 인증서 발급 (Certbot)

### 2.1 Certbot 설치 및 실행

Staging 서버에서:

```bash
# Certbot 설치 (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y certbot

# 인증서 발급 (Standalone mode - 기존 Nginx와 충돌 방지)
sudo certbot certonly \
  --standalone \
  --email admin@doremi-live.com \
  --agree-tos \
  --non-interactive \
  -d staging.doremi-live.com
```

**성공 시 메시지:**

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/staging.doremi-live.com/fullchain.pem
Key is saved at: /etc/letsencrypt/live/staging.doremi-live.com/privkey.pem
```

### 2.2 인증서를 Docker 볼륨 위치로 복사

```bash
# Dorami 프로젝트 디렉토리
cd /opt/dorami

# SSL 디렉토리 생성
mkdir -p nginx/ssl

# Let's Encrypt 인증서 복사
sudo cp /etc/letsencrypt/live/staging.doremi-live.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/staging.doremi-live.com/privkey.pem nginx/ssl/

# 권한 설정 (Docker가 읽을 수 있도록)
sudo chmod 644 nginx/ssl/fullchain.pem
sudo chmod 644 nginx/ssl/privkey.pem
sudo chown $(whoami):$(whoami) nginx/ssl/*
```

### 2.3 docker-compose 설정 확인

`docker-compose.staging.yml`에서 Nginx 설정이 이미 다음과 같이 업데이트되었는지 확인:

```yaml
nginx:
  volumes:
    - ./nginx/staging-ssl.conf:/etc/nginx/conf.d/default.conf
    - ./nginx/ssl:/etc/nginx/ssl:ro # SSL 인증서 마운트
  ports:
    - '80:80'
    - '443:443'
```

## 3단계: Docker Compose 배포

```bash
cd /opt/dorami

# 환경 설정 로드
export IMAGE_TAG=sha-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export GITHUB_REPOSITORY_OWNER=yourorg

# 이미지 풀
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml pull

# 서비스 시작
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml up -d --force-recreate

# 로그 확인
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml logs -f nginx
```

## 4단계: HTTPS 검증

```bash
# HTTP → HTTPS 리다이렉트 확인
curl -I http://staging.doremi-live.com
# Expected: 301 redirect to https://

# HTTPS 접속 테스트
curl -I https://staging.doremi-live.com
# Expected: 200 OK

# SSL 인증서 확인
openssl s_client -connect staging.doremi-live.com:443 -servername staging.doremi-live.com
```

## 5단계: 자동 갱신 설정

Let's Encrypt 인증서는 90일마다 만료됩니다. Certbot 자동 갱신을 설정합니다.

### 5.1 Certbot 자동 갱신 활성화

```bash
# Certbot 자동 갱신 서비스 시작 (Ubuntu 20.04+)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 상태 확인
sudo systemctl status certbot.timer

# 갱신 테스트 (dry-run)
sudo certbot renew --dry-run
```

### 5.2 인증서 갱신 후 Docker 리로드

자동 갱신 후 Nginx를 리로드하기 위해 Cron 작업을 추가합니다.

`/etc/cron.d/dorami-nginx-reload`:

```cron
# Renew Let's Encrypt certificates and reload Nginx
0 3 * * * /usr/local/bin/certbot-renew-and-reload.sh
```

`/usr/local/bin/certbot-renew-and-reload.sh`:

```bash
#!/bin/bash
set -e

DORAMI_DIR="/opt/dorami"

# Certbot 갱신
/usr/bin/certbot renew --quiet

# 인증서 복사
cp /etc/letsencrypt/live/staging.doremi-live.com/fullchain.pem ${DORAMI_DIR}/nginx/ssl/
cp /etc/letsencrypt/live/staging.doremi-live.com/privkey.pem ${DORAMI_DIR}/nginx/ssl/

# Nginx 컨테이너 리로드
cd ${DORAMI_DIR}
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml exec -T nginx nginx -s reload || true

# 로그 기록
echo "[$(date)] SSL certificate renewed and Nginx reloaded" >> /var/log/dorami-ssl-renewal.log
```

권한 설정:

```bash
sudo chmod 755 /usr/local/bin/certbot-renew-and-reload.sh
sudo chown root:root /usr/local/bin/certbot-renew-and-reload.sh
```

## 6단계: GitHub Actions 배포 파일 조정 (선택사항)

CI/CD에서 자동 배포 시 SSL 인증서 처리:

`.github/workflows/deploy-staging.yml`에서 Nginx 설정 파일 선택:

```bash
# 기존
./nginx/staging.conf

# 변경
./nginx/staging-ssl.conf
```

## 문제 해결

### HTTPS가 작동하지 않음

```bash
# 1. 포트 443이 열려 있는지 확인
sudo netstat -tlnp | grep 443

# 2. Nginx 설정 테스트
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml exec nginx nginx -t

# 3. Nginx 로그 확인
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml logs nginx

# 4. 인증서 권한 확인
ls -la nginx/ssl/
```

### 인증서 만료 경고

```bash
# 남은 만료 일수 확인
sudo certbot certificates

# 수동 갱신
sudo certbot renew --force-renewal
```

### Certbot 갱신 실패

```bash
# 갱신 로그 확인
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# 스탠드얼론 모드로 갱신 시도
sudo certbot renew --standalone --preferred-challenges http
```

## 참고

- [Let's Encrypt 문서](https://letsencrypt.org/docs/)
- [Certbot 문서](https://certbot.eff.org/docs/)
- [Nginx SSL 설정](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
