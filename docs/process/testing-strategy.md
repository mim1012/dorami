# 환경별 테스트 전략

**프로젝트**: Dorami Live Commerce

---

## 테스트 피라미드

```
        ┌─────────┐
        │  E2E    │  소수 — 핵심 사용자 플로우
        ├─────────┤
        │ 통합    │  중간 — API/서비스 레이어
        ├─────────┤
        │ 유닛    │  다수 — 비즈니스 로직, 유틸리티
        └─────────┘
```

## 환경별 테스트 범위

### Local (개발자 PC)

| 항목        | 도구       | 실행 시점                               |
| ----------- | ---------- | --------------------------------------- |
| 유닛 테스트 | Jest       | 코드 변경 시 (`npm run test:backend`)   |
| 타입 체크   | TypeScript | 저장 시 자동 (`npm run type-check:all`) |
| 린트        | ESLint     | 저장 시 자동 (`npm run lint:all`)       |
| 수동 테스트 | 브라우저   | 기능 개발 완료 시                       |

```bash
# 전체 로컬 테스트 실행
npm run test:all
npm run type-check:all
npm run lint:all
```

### CI (GitHub Actions)

PR 생성 및 `develop`/`main` 푸시 시 자동 실행됩니다.

| 항목                     | 조건             | 파이프라인                                   |
| ------------------------ | ---------------- | -------------------------------------------- |
| 변경 감지                | 모든 PR/Push     | Backend/Frontend/Infra 별 감지               |
| Backend 린트 + 타입 체크 | Backend 변경 시  | `ci.yml`                                     |
| Backend 유닛 테스트      | Backend 변경 시  | `ci.yml`                                     |
| Backend E2E 테스트       | Backend 변경 시  | `ci.yml` (PostgreSQL, Redis 서비스 컨테이너) |
| Frontend 빌드            | Frontend 변경 시 | `ci.yml`                                     |
| Docker 이미지 빌드       | 변경 시          | `ci.yml`                                     |
| 보안 스캔 (Trivy)        | 항상             | `ci.yml`                                     |

### Staging (54.180.94.30)

`develop` 브랜치 Merge 후 자동 배포됩니다.

| 항목                   | 방법                                | 담당   |
| ---------------------- | ----------------------------------- | ------ |
| 스모크 테스트          | 배포 후 자동 (`deploy-staging.yml`) | CI     |
| API 기능 테스트        | Postman / curl                      | 개발자 |
| 라이브 스트리밍 테스트 | OBS → RTMP 연결                     | 개발자 |
| UI 크로스 브라우저     | Chrome, Safari, Mobile              | 개발자 |
| 결제 플로우            | 테스트 결제 키 사용                 | QA     |

```bash
# Staging 헬스체크
curl http://54.180.94.30/api/v1/health

# API 응답 확인
curl http://54.180.94.30/api/v1/products
```

### Production

릴리즈 태그 생성 또는 수동 배포 후 실행합니다.

| 항목             | 방법                  | 담당   |
| ---------------- | --------------------- | ------ |
| 스모크 테스트    | 배포 후 자동          | CI     |
| 핵심 플로우 검증 | 수동 체크리스트       | QA     |
| 모니터링 확인    | CloudWatch, 로그      | DevOps |
| 롤백 준비        | 이전 이미지 태그 확인 | DevOps |

## 테스트 실행 명령어

```bash
# 유닛 테스트
npm run test:backend

# E2E 테스트 (로컬 — Docker 서비스 필요)
npm run test:e2e

# 전체 테스트
npm run test:all

# 특정 파일 테스트
npx jest --config backend/jest.config.ts backend/src/modules/products/products.service.spec.ts

# 커버리지 리포트
npx jest --config backend/jest.config.ts --coverage
```

## 테스트 작성 기준

### 반드시 테스트해야 하는 항목

- API 엔드포인트 (컨트롤러 레벨)
- 비즈니스 로직이 있는 서비스 메서드
- 인증/인가 로직
- 결제 관련 로직
- 데이터 변환/검증 로직

### 테스트하지 않아도 되는 항목

- 단순 CRUD (Prisma 위임)
- DTO 정의
- 설정 파일
- 외부 라이브러리 래핑

## 관련 문서

- [CI/CD 파이프라인](../deployment/ci-cd-pipeline.md)
- [Staging 테스트 가이드](../deployment/staging-testing-guide.md)
- [E2E 테스트 리포트](../reports/testing/E2E_TEST_REPORT.md)
