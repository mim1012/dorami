# Deployment Checklist (Morning Check)

배포 전 아침 체크리스트. 모든 항목 확인 후 배포를 진행하세요.

## Pre-Deployment (배포 전)

### Infrastructure

- [ ] Docker 데몬 실행 중 (`docker info`)
- [ ] PostgreSQL 컨테이너 healthy (`docker ps | grep postgres`)
- [ ] Redis 컨테이너 healthy (`docker ps | grep redis`)
- [ ] 디스크 여유 공간 1GB 이상 (`df -h`)
- [ ] 메모리 여유 512MB 이상 (`free -m`)

### Code Quality

- [ ] `npm run lint:all` — 에러 없음
- [ ] `npm run type-check:all` — 타입 에러 없음
- [ ] `npm run test:backend` — 유닛 테스트 통과
- [ ] `npm run build:all` — 빌드 성공

### Database

- [ ] DB 백업 완료 (`bash scripts/backup-postgres.sh`)
- [ ] 마이그레이션 상태 확인 (`bash scripts/migration-status.sh`)
- [ ] 파괴적 마이그레이션 없음 (`bash scripts/check-destructive-migrations.sh`)
- [ ] DB 연결 수 정상 (`bash scripts/check-db-connections.sh --once`)

### Environment

- [ ] `.env.production` 환경변수 검증 (`bash scripts/validate-env.sh`)
- [ ] `IMAGE_TAG` 확정 (CI 빌드 완료된 이미지)
- [ ] Git working tree clean (`git status`)

## Deployment (배포 실행)

```bash
# 1. Preflight 자동 검증
bash scripts/preflight-check.sh

# 2. 배포 실행
IMAGE_TAG=sha-xxxxxx bash scripts/deploy-prod.sh

# 3. 또는 수동 단계별:
#    a) DB 백업
#    b) 이미지 pull
#    c) docker compose up -d
#    d) health check 확인
```

## Post-Deployment (배포 후)

### Immediate (즉시 확인 — 5분 이내)

- [ ] Health check 통과 (`bash scripts/health-check.sh --once --url https://www.doremi-live.com`)
- [ ] 메인 페이지 로드 (`curl -sf https://www.doremi-live.com`)
- [ ] API 응답 정상 (`curl -sf https://www.doremi-live.com/api/health/ready`)
- [ ] 에러 로그 없음 (`bash scripts/aggregate-logs.sh --since 5m`)

### Functional (기능 확인 — 15분 이내)

- [ ] 카카오 로그인 정상
- [ ] 상품 목록 조회 정상
- [ ] 상품 상세 페이지 로드
- [ ] 장바구니 추가 동작
- [ ] 관리자 페이지 접근 가능
- [ ] WebSocket 연결 (채팅 동작)

### Monitoring (모니터링 — 30분)

- [ ] 리소스 사용량 정상 (`bash scripts/monitor-resources.sh --once`)
- [ ] DB 연결 수 안정 (`bash scripts/check-db-connections.sh --once`)
- [ ] 에러 로그 증가 없음 (`bash scripts/aggregate-logs.sh --since 30m`)

## Rollback (문제 시)

```bash
# 자동 롤백 (알려진 안정 버전 54dd099)
bash scripts/rollback.sh

# 특정 태그로 롤백
bash scripts/rollback.sh --tag sha-xxxxxx

# 롤백 파일 사용
bash scripts/rollback.sh --file .backups/rollback-xxx.env
```

## Emergency Contacts

| 구분         | 확인 사항                                           |
| ------------ | --------------------------------------------------- |
| Backend 장애 | `docker logs dorami-backend-1 --tail 50`            |
| DB 장애      | `docker logs dorami-postgres-1 --tail 50`           |
| Redis 장애   | `docker logs dorami-redis-1 --tail 50`              |
| 전체 복구    | `docker compose -f docker-compose.prod.yml restart` |

## Quick Reference

```bash
# 전체 상태 한눈에
bash scripts/health-check.sh --once
bash scripts/monitor-resources.sh --once
bash scripts/check-db-connections.sh --once

# 에러 로그 수집
bash scripts/aggregate-logs.sh --since 1h

# 종합 리포트 생성
node scripts/generate-comprehensive-report.js
```
