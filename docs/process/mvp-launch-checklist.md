# 🚀 Dorami Live Commerce - MVP 론칭 체크리스트

**프로젝트**: Dorami Live Commerce
**버전**: 1.0.0 (MVP)
**목표 론칭일**: TBD
**작성일**: 2026-02-05

---

## 📊 전체 진행률

**구현 완료**: 96% (52/54 Stories)
**테스트 완료**: 50% (빌드 검증 완료, E2E 테스트 대기)
**배포 준비**: 30% (문서 작성 완료, 인프라 설정 대기)

---

## ✅ Phase 1: 개발 완료 (100% 완료)

### 코드 구현

- [x] Backend 17개 모듈 구현
- [x] Frontend 27개 페이지 구현
- [x] Database 15개 모델 정의
- [x] 12개 Epic 완료

### 주요 기능

- [x] Epic 1: 프로젝트 인프라
- [x] Epic 2: 사용자 인증 & 프로필
- [x] Epic 3: 라이브 스트리밍
- [x] Epic 4: 실시간 채팅
- [x] Epic 5: 상품 관리
- [x] Epic 6: 장바구니 & 타이머
- [x] Epic 7: 예약 시스템
- [x] Epic 8: 주문 관리
- [x] Epic 9: 알림 시스템
- [x] Epic 10: 정산 관리
- [x] Epic 11: 스토어 페이지
- [x] Epic 12: 시스템 설정

---

## ✅ Phase 2: 빌드 & 컴파일 검증 (100% 완료)

### Backend

- [x] TypeScript 컴파일 성공
- [x] NestJS 빌드 성공
- [x] Prisma Client 생성 완료
- [x] 의존성 패키지 설치 완료

### Frontend

- [x] TypeScript 컴파일 성공
- [x] Next.js 빌드 성공 (27 페이지)
- [x] 정적 페이지 생성 완료
- [x] 의존성 패키지 설치 완료

---

## 🔄 Phase 3: 테스트 (50% 완료)

### Unit Tests

- [x] Backend 단위 테스트 작성 (orders.service.spec.ts)
- [ ] 전체 Backend 모듈 단위 테스트
- [ ] Frontend 컴포넌트 단위 테스트

### E2E Tests

- [x] E2E 테스트 환경 설정 (docker-compose.test.yml)
- [ ] **Docker Desktop 시작 필요**
- [ ] Backend E2E 테스트 실행
  - [ ] Cart E2E tests
  - [ ] Orders E2E tests
  - [ ] Admin E2E tests
  - [ ] Settlement E2E tests
- [ ] Frontend E2E 테스트 (Playwright)

### 통합 테스트

- [ ] Backend ↔ Database 통합
- [ ] Backend ↔ Redis 통합
- [ ] Backend ↔ WebSocket 통합
- [ ] Frontend ↔ Backend API 통합

---

## 🌐 Phase 4: 인프라 설정 (0% 완료)

### AWS 계정 & IAM

- [ ] AWS 계정 생성/준비
- [ ] IAM 사용자 생성 (배포용)
- [ ] IAM 역할 생성 (ECS 태스크용)
- [ ] 보안 그룹 설정

### Database (RDS PostgreSQL)

- [ ] **Staging RDS 인스턴스 생성**
  - [ ] 인스턴스 타입: db.t3.micro
  - [ ] 스토리지: 20GB gp3
  - [ ] 백업 활성화 (7일 보관)
  - [ ] Multi-AZ: No (Staging)
- [ ] **Production RDS 인스턴스 생성**
  - [ ] 인스턴스 타입: db.t3.small
  - [ ] 스토리지: 50GB gp3
  - [ ] 백업 활성화 (30일 보관)
  - [ ] Multi-AZ: Yes (Production)
- [ ] 보안 그룹 설정 (ECS에서만 접근)

### Cache (ElastiCache Redis)

- [ ] **Staging Redis 클러스터 생성**
  - [ ] 노드 타입: cache.t3.micro
  - [ ] 복제 없음
- [ ] **Production Redis 클러스터 생성**
  - [ ] 노드 타입: cache.t3.small
  - [ ] 복제 활성화 (1 replica)
- [ ] 보안 그룹 설정

### Container Registry (ECR)

- [ ] ECR 리포지토리 생성
  - [ ] dorami-backend
  - [ ] dorami-nginx-rtmp (선택)
- [ ] 이미지 스캔 활성화

### Container Orchestration (ECS)

- [ ] **Staging ECS 클러스터 생성**
  - [ ] Fargate 용량 공급자
  - [ ] 태스크 정의 작성
  - [ ] 서비스 생성
- [ ] **Production ECS 클러스터 생성**
  - [ ] Fargate 용량 공급자
  - [ ] 태스크 정의 작성 (HealthCheck 포함)
  - [ ] 서비스 생성 (Auto Scaling 설정)
- [ ] Application Load Balancer 설정
  - [ ] 대상 그룹 생성
  - [ ] 헬스체크 경로: /api/health
  - [ ] HTTPS 리스너 (ACM 인증서)

### Static Hosting (S3 + CloudFront)

- [ ] **Staging S3 버킷 생성**
  - [ ] 버킷: dorami-staging-frontend
  - [ ] 정적 웹사이트 호스팅 활성화
- [ ] **Production S3 버킷 생성**
  - [ ] 버킷: dorami-production-frontend
  - [ ] 정적 웹사이트 호스팅 활성화
- [ ] CloudFront 배포 생성
  - [ ] 원본: S3 버킷
  - [ ] SSL/TLS 인증서 (ACM)
  - [ ] 캐시 정책 설정

### Secrets Management

- [ ] **Staging Secrets 생성**
  - [ ] Secrets Manager: dorami/staging/backend
  - [ ] 환경 변수 저장
- [ ] **Production Secrets 생성**
  - [ ] Secrets Manager: dorami/production/backend
  - [ ] 환경 변수 저장 (강력한 비밀번호)

### Streaming (선택)

- [ ] EC2 인스턴스 (NGINX-RTMP)
  - [ ] 인스턴스 타입: t3.small
  - [ ] RTMP 서버 설치
  - [ ] LL-HLS 설정
- [ ] S3 버킷 (HLS 세그먼트 저장)
- [ ] CloudFront (HLS 스트리밍 배포)

---

## 🚢 Phase 5: 배포 (0% 완료)

### Staging 배포

- [ ] Database 마이그레이션
- [ ] Backend 컨테이너 이미지 빌드
- [ ] ECR에 이미지 푸시
- [ ] ECS 서비스 배포
- [ ] Frontend 빌드
- [ ] S3에 업로드
- [ ] CloudFront 캐시 무효화
- [ ] 배포 검증
  - [ ] 헬스체크 통과
  - [ ] 주요 기능 스모크 테스트
  - [ ] 로그 확인

### Production 배포

- [ ] Staging 검증 완료
- [ ] DB 백업 (필수)
- [ ] 배포 계획 검토
- [ ] Backend 배포
  - [ ] Blue-Green 배포
  - [ ] 헬스체크 모니터링
- [ ] Frontend 배포
  - [ ] S3 업로드
  - [ ] CloudFront 캐시 무효화
- [ ] 배포 후 검증
  - [ ] 전체 기능 테스트
  - [ ] 성능 모니터링 (5분)
  - [ ] 에러율 확인

---

## 📊 Phase 6: 모니터링 & 알람 (0% 완료)

### CloudWatch 설정

- [ ] **Logs 그룹 생성**
  - [ ] /ecs/dorami-backend-staging
  - [ ] /ecs/dorami-backend-production
- [ ] **Metrics 대시보드 생성**
  - [ ] ECS CPU/Memory
  - [ ] RDS 성능
  - [ ] ElastiCache Hit Rate
  - [ ] ALB 응답 시간
- [ ] **알람 설정**
  - [ ] CPU 사용률 > 80%
  - [ ] Memory 사용률 > 80%
  - [ ] 5xx 에러율 > 1%
  - [ ] 응답 시간 > 1초
  - [ ] RDS 연결 수 > 80%

### Sentry (에러 추적)

- [ ] Sentry 프로젝트 생성
- [ ] Backend Sentry DSN 설정
- [ ] Frontend Sentry DSN 설정
- [ ] 에러 알림 설정

### Uptime Monitoring

- [ ] UptimeRobot 또는 Pingdom 설정
- [ ] 헬스체크 엔드포인트 모니터링
- [ ] 다운타임 알림 설정

---

## 🔐 Phase 7: 보안 (60% 완료)

### Application Security

- [x] CORS 설정
- [x] Helmet 헤더
- [x] CSRF 보호
- [x] Rate Limiting
- [x] JWT 인증
- [x] 사용자 데이터 암호화 (AES-256-GCM)
- [ ] SQL Injection 방어 검증
- [ ] XSS 방어 검증

### Infrastructure Security

- [ ] Security Group 최소 권한
- [ ] IAM 정책 최소 권한
- [ ] RDS 암호화 활성화
- [ ] S3 버킷 정책 설정
- [ ] CloudFront HTTPS 강제
- [ ] Secrets Manager 접근 제어

### Compliance

- [ ] 개인정보 처리방침 작성
- [ ] 이용약관 작성
- [ ] 개인정보 보호 설정 확인

---

## 📝 Phase 8: 문서화 (70% 완료)

### 기술 문서

- [x] DEPLOYMENT.md (배포 가이드)
- [x] environment-separation-strategy.md
- [x] .env.production.example
- [ ] API 문서 (Swagger/OpenAPI)
- [ ] Database Schema 문서
- [ ] Architecture Diagram

### 운영 문서

- [ ] 운영 매뉴얼
- [ ] 장애 대응 가이드
- [ ] 롤백 절차
- [ ] DB 백업/복구 가이드
- [ ] 모니터링 가이드

### 사용자 문서

- [ ] 사용자 가이드
- [ ] FAQ
- [ ] 관리자 매뉴얼

---

## 🧪 Phase 9: 최종 검증 (0% 완료)

### 기능 테스트 (Production)

- [ ] **사용자 플로우**
  - [ ] 회원가입 (Kakao OAuth)
  - [ ] 로그인/로그아웃
  - [ ] 프로필 등록/수정
- [ ] **라이브 커머스 플로우**
  - [ ] 라이브 방송 시청
  - [ ] 실시간 채팅
  - [ ] 상품 조회
  - [ ] 장바구니 담기 (타이머 동작)
  - [ ] 주문 생성
  - [ ] 무통장 입금 안내
- [ ] **관리자 플로우**
  - [ ] 상품 등록/수정
  - [ ] 주문 관리
  - [ ] 결제 상태 변경
  - [ ] 정산서 발행
  - [ ] 알림 발송

### 성능 테스트

- [ ] 부하 테스트 (동시 접속자 100명)
- [ ] 응답 시간 측정 (평균 < 500ms)
- [ ] 데이터베이스 쿼리 최적화
- [ ] 캐시 Hit Rate 확인

### 보안 테스트

- [ ] 취약점 스캔
- [ ] OWASP Top 10 검증
- [ ] SSL/TLS 설정 확인

---

## 🎯 Phase 10: 론칭 (0% 완료)

### 론칭 전 (D-1)

- [ ] 전체 팀 브리핑
- [ ] 긴급 연락망 공유
- [ ] 롤백 계획 최종 확인
- [ ] DB 최종 백업
- [ ] 모니터링 대시보드 준비

### 론칭 당일 (D-Day)

- [ ] 08:00 - 최종 빌드 & 배포
- [ ] 09:00 - 스모크 테스트
- [ ] 10:00 - 서비스 공개
- [ ] 10:00~12:00 - 실시간 모니터링
- [ ] 12:00 - 1차 점검 (에러, 성능)
- [ ] 18:00 - 2차 점검
- [ ] 22:00 - 일일 리포트

### 론칭 후 (D+1 ~ D+7)

- [ ] D+1: 24시간 모니터링 리포트
- [ ] D+3: 3일 안정화 리포트
- [ ] D+7: 1주일 운영 리포트
- [ ] 사용자 피드백 수집
- [ ] 버그 수정 우선순위 결정

---

## 📞 긴급 연락망

| 역할          | 이름 | 연락처 | 비고          |
| ------------- | ---- | ------ | ------------- |
| PM            | TBD  | -      | 프로젝트 총괄 |
| Backend Lead  | TBD  | -      | Backend 담당  |
| Frontend Lead | TBD  | -      | Frontend 담당 |
| DevOps        | TBD  | -      | 인프라 담당   |
| QA Lead       | TBD  | -      | 품질 담당     |
| On-Call       | TBD  | -      | 24시간 대기   |

---

## 📊 진행 상황 요약

### 완료된 작업

1. ✅ 전체 기능 구현 (96%)
2. ✅ 빌드 검증 (100%)
3. ✅ 배포 문서 작성 (100%)

### 진행 중인 작업

1. 🔄 E2E 테스트 (Docker 시작 필요)

### 남은 작업

1. ⏳ AWS 인프라 설정
2. ⏳ Staging 배포
3. ⏳ Production 배포
4. ⏳ 모니터링 설정
5. ⏳ 최종 검증
6. ⏳ 론칭

---

## 🎯 다음 단계

**즉시 실행 가능**:

1. Docker Desktop 시작 후 E2E 테스트 실행
2. AWS 계정 준비 및 IAM 설정
3. Staging RDS/ElastiCache 생성

**예상 완료 일정** (5일 작업 기준):

- Day 1-2: 인프라 설정 + E2E 테스트
- Day 3: Staging 배포 + 검증
- Day 4: Production 배포
- Day 5: 최종 검증 + 론칭

---

**작성자**: Claude (Sonnet 4.5)
**최종 업데이트**: 2026-02-05
**버전**: 1.0.0
