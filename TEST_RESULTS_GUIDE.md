# Test Results Interpretation Guide

이 문서는 Dorami 프로젝트의 각 테스트 결과를 해석하는 방법을 설명합니다.

## 테스트 종류별 해석

### 1. Unit Tests (Jest)

**위치**: `backend/` 디렉토리에서 실행
**명령어**: `npm run test:backend`

| 결과          | 의미               | 조치                   |
| ------------- | ------------------ | ---------------------- |
| All passed    | 비즈니스 로직 정상 | 배포 가능              |
| 1-2 failures  | 특정 모듈 문제     | 해당 모듈 확인 후 수정 |
| 다수 failures | 구조적 문제        | 배포 중단, 원인 분석   |

**핵심 지표**:

- `numPassedTests` / `numTotalTests` = 통과율 (95% 이상 권장)
- `testSuites` 전체 통과 여부
- 실행 시간 (30초 이내 정상)

### 2. E2E Tests (Playwright)

**위치**: `client-app/e2e/`
**명령어**: `cd client-app && npx playwright test`

| 결과              | 의미               | 조치                      |
| ----------------- | ------------------ | ------------------------- |
| All passed        | 사용자 플로우 정상 | 배포 가능                 |
| Timeout failures  | 서버 응답 지연     | 서버 상태 확인            |
| Element not found | UI 변경 감지       | 셀렉터 업데이트 필요      |
| Auth failures     | 인증 문제          | dev-login 엔드포인트 확인 |

**핵심 지표**:

- 전체 통과율 (90% 이상 권장)
- 평균 테스트 실행 시간
- 스크린샷/비디오 (실패 시 자동 저장)

### 3. Load Test (5 동시 사용자)

**위치**: `client-app/e2e/load-test.spec.ts`
**명령어**: `cd client-app && npx playwright test load-test.spec.ts`

| 지표           | 정상     | 주의       | 위험     |
| -------------- | -------- | ---------- | -------- |
| Login 응답시간 | < 500ms  | 500-2000ms | > 2000ms |
| Product 조회   | < 300ms  | 300-1000ms | > 1000ms |
| Cart 추가      | < 500ms  | 500-1500ms | > 1500ms |
| 주문 생성      | < 1000ms | 1-3s       | > 3s     |
| 전체 성공률    | 100%     | 80-99%     | < 80%    |

### 4. Health Check

**명령어**: `bash scripts/health-check.sh --once`

| 엔드포인트          | 정상 응답                       | 의미             |
| ------------------- | ------------------------------- | ---------------- |
| `/api/health/live`  | `{"status":"ok"}`               | 프로세스 생존    |
| `/api/health/ready` | `{"status":"ok"}` + DB/Redis up | 트래픽 수용 가능 |

- Liveness 실패 → 컨테이너 재시작 필요
- Readiness 실패 → DB 또는 Redis 연결 확인

### 5. Network Simulation

**명령어**: `node scripts/network-simulation-test.js`

| 조건                 | 허용 가능한 성능 저하   |
| -------------------- | ----------------------- |
| 3G (1Mbps)           | 응답시간 2-3x 증가 허용 |
| High Latency (500ms) | +500ms 오버헤드 허용    |
| Packet Loss (5%)     | 성공률 90% 이상         |
| Variable             | 성공률 85% 이상         |

### 6. DB Connection Monitor

**명령어**: `bash scripts/check-db-connections.sh --once`

| 지표                  | 정상  | 주의   | 위험  |
| --------------------- | ----- | ------ | ----- |
| 연결 사용률           | < 50% | 50-80% | > 80% |
| 대기 쿼리             | 0     | 1-5    | > 5   |
| 장기 실행 쿼리 (>30s) | 0     | 1-2    | > 2   |

### 7. Resource Monitor

**명령어**: `bash scripts/monitor-resources.sh --once`

| 지표          | 정상  | 주의   | 위험  |
| ------------- | ----- | ------ | ----- |
| CPU 사용량    | < 60% | 60-85% | > 85% |
| 메모리 사용량 | < 70% | 70-90% | > 90% |
| 디스크 여유   | > 5GB | 1-5GB  | < 1GB |

## 종합 점수 해석

`reports/comprehensive-test-report.md` 에서 100점 만점 점수를 제공합니다:

| 점수   | 판정      | 배포 권장                           |
| ------ | --------- | ----------------------------------- |
| 90-100 | EXCELLENT | 즉시 배포 가능                      |
| 70-89  | GOOD      | 배포 가능 (경미한 이슈 모니터링)    |
| 50-69  | FAIR      | 조건부 배포 (이슈 수정 후 재테스트) |
| 0-49   | POOR      | 배포 중단                           |

## 로그 파일 위치

| 파일                                      | 내용                     |
| ----------------------------------------- | ------------------------ |
| `reports/health-check.log`                | Health check 이력        |
| `reports/resource-monitor.log`            | 리소스 모니터링 이력     |
| `reports/db-connections.log`              | DB 연결 추적             |
| `reports/aggregated-errors.log`           | ERROR/CRITICAL 로그 종합 |
| `reports/network-simulation-results.json` | 네트워크 시뮬레이션 결과 |
| `reports/comprehensive-test-report.md`    | 최종 종합 리포트         |
