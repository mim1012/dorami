# 🚀 Dorami Deployment Decision Framework

**최종 작성**: 2026-03-02
**상태**: FINAL
**Ralph Loop**: Iteration 5

---

## ⚠️ 핵심 변경: "배포 즉시 가능" → "CONDITIONAL"

### 이전 판정 (❌ 부정확):

```
배포: 즉시 가능 ← Production Migration만 분석함
```

### 새 판정 (✅ 정확):

```
배포: CONDITIONAL
  ├─ Migration 안전성: ✅ SAFE (non-destructive only)
  ├─ Production 안정성: ✅ SAFE (45h uptime, 0 restarts)
  └─ Staging Load Test: ⏳ PENDING (200 CCU × 60분 결과 대기)

최종 판정: Load Test 결과 + Architect 승인 후 배포 가능
```

---

## 📋 배포 판정 체크리스트 (COMPLETE)

### Phase 1: 정적 분석 ✅ (완료)

- [x] Git branch 상태 확인
- [x] Production migration 분석 (5개, 모두 안전)
- [x] Local pending migration 분석 (10개, 모두 안전)
- [x] Migration destructive 여부 (0개)
- [x] Production DB 백업 (98KB, 검증)
- [x] Docker 상태 확인 (6 containers, 0 restarts)
- [x] 환경변수 검증 (완벽)

**결과: ✅ SAFE (정적 분석만으로는 배포 가능)**

### Phase 2: 동적 부하 테스트 ⏳ (진행 중)

- [ ] Staging 200 CCU 부하 테스트 (RUNNING)
- [ ] CPU < 70% 확인 (대기)
- [ ] Memory < 75% 확인 (대기)
- [ ] Error rate < 1% 확인 (대기)
- [ ] WebSocket 안정성 (대기)
- [ ] DB connection pool (대기)
- [ ] Redis eviction (대기)

**예상 완료**: 2026-03-01 01:25 UTC

### Phase 3: Architect 검증 ⏳ (대기)

- [ ] Night QA 리포트 검토
- [ ] 리스크 평가
- [ ] 배포 승인/거절 판정
- [ ] Rollback 계획 수립

---

## 🎯 배포 판정 규칙 (데이터 바인딩 기반)

### ⚠️ CRITICAL: 배포는 "데이터 기준"으로 판단한다

```
배포 준비 완료 조건:
  ✅ UI Data Binding: 고객 + 관리자 모든 기능이 DB와 동기화
  ✅ Product Query: 상품 조회 완벽 (가격, 재고, 이미지)
  ✅ Shopping Cart: 장바구니 추가/제거/수량 변경 정상 작동
  ✅ Purchase Flow: 구매 시작 ~ 주문 완료까지 데이터 흐름 정상
  ✅ Live Streaming: 방송 조회, 제어, 상품 연동 정상
  ✅ Admin Panel: 모든 관리자 페이지 기능이 DB 데이터와 일치
  ✅ Real-time Updates: WebSocket 채팅, 뷰어 수, 재고 업데이트 실시간
  ✅ Load Test: 200 CCU 부하에서 모든 기능 안정적
  ✅ Architect Approval: 검증 완료 및 승인
```

### 배포 판정 알고리즘

```
IF Data_Binding == PERFECT && Load_Test == PASS && Architect == APPROVED:
  ├─ Status: SAFE ✅
  ├─ Action: 즉시 배포 가능
  └─ Confidence: 95%+

ELSE IF Data_Binding == PARTIAL || Load_Test == CONDITIONAL:
  ├─ Status: CONDITIONAL ⏳
  ├─ Action: 데이터 바인딩 수정 + 재테스트
  └─ Confidence: 60-80%

ELSE IF Data_Binding == BROKEN || Load_Test == FAIL:
  ├─ Status: BLOCKED 🛑
  ├─ Action: 배포 차단, 자동 수정 실행
  └─ Confidence: 0%
```

---

## 🌙 Night QA System (최종 설계)

### 목표

- 밤 11시 자동 실행
- Streaming / CRUD / UI / Load / DB Drift 자동 검증
- 실패 시 자동 수정 + 재검증
- 아침 7시 종합 리포트
- 배포 판정 명확화

### 6대 검증 영역

#### 1️⃣ DB Drift & Migration Safety

```
실행: Production vs Staging vs Local 스키마 비교
결과: SAFE / CONDITIONAL / DESTRUCTIVE 분류
```

#### 2️⃣ Streaming Validation (RTMP→HLS)

```
실행: ffmpeg RTMP push → SRS ingest → HLS m3u8
검증: 지연시간 < 2초, 세그먼트 생성 정상
자동 수정: port, network, SRS max_conn 조정
```

#### 3️⃣ Product CRUD + 권한 검증

```
실행: Admin 상품 생성 → 옵션 추가 → 가격 수정 → 사용자 조회
검증: DB row 생성, FK 연결, DTO 일치, 권한 분리
자동 수정: 권한 설정 수정, API 응답 개선
```

#### 4️⃣ UI Data Binding Verification (CRITICAL) — Playwright

```
실행 (고객 UI):
  ✅ 상품 조회: 가격, 재고, 이미지, 설명 정확히 표시
  ✅ 장바구니: 아이템 추가/제거, 수량 변경, 총액 계산 정상
  ✅ 장바구니 타이머: 정확히 10분 카운트다운 표시
  ✅ 구매 플로우: 결제 ~ 주문 완료까지 데이터 흐름 정상
  ✅ 주문 내역: 모든 이전 주문이 정확한 상태로 표시
  ✅ 라이브 스트림: 방송 조회, 실시간 상품 추천 업데이트

실행 (관리자 UI):
  ✅ 상품 관리: CRUD 작동, 생성 즉시 목록에 반영
  ✅ 방송 제어: 라이브/오프라인 상태 토글 정상
  ✅ 재고 관리: 변경 즉시 UI에 반영
  ✅ 주문 관리: 모든 주문 고객 정보와 함께 표시
  ✅ 결제 내역: 계산된 매출이 DB 기록과 일치
  ✅ 사용자 관리: 전체 계정 관리 기능 작동

실행 (실시간 업데이트):
  ✅ 채팅: 메시지가 모든 사용자에게 즉시 표시
  ✅ 뷰어 수: 사용자 입장/퇴장 시 실시간 업데이트
  ✅ 재고: 변경사항 즉시 상품 페이지에 반영
  ✅ 방송 상태: LIVE/OFFLINE 모든 클라이언트에 동기화
  ✅ 알림: 페이지 새로고침 없이 표시

검증: 실제 DB 데이터 vs 렌더링된 UI 일치성 100%
자동 수정: React state binding, API 응답, 조건 로직 수정
```

#### 5️⃣ Progressive Load Test (k6)

```
단계별 실행:
  50명 (30분)
  100명 (30분)
  150명 (30분)
  200명 (60분)

모니터링: CPU, Memory, Error rate, Redis, DB connection, Latency
임계값 초과 시 자동 조정
```

#### 6️⃣ Comprehensive Report

```
생성: 아침 7시
내용: 각 영역별 PASS/FAIL, Risk level, 배포 판정
형식: Markdown + JSON (CI/CD 연동)
```

---

## 🔁 자동 수정 로직 (Ralph Loop)

```
if TEST FAILS:
  for attempt in 1..3:
    1. Root cause 분석
    2. Fix 제안 생성
    3. Fix 자동 적용
    4. 동일 test 재실행

    if PASS:
      → 리포트에 "RETRY #N: PASS" 기록
      → 다음 test 진행
    else if attempt < 3:
      → 다른 fix 시도
    else:
      → FAIL 표시
      → 배포 차단
```

---

## 🛡️ Production 보호 정책

✅ Staging DB만 사용
✅ Production read-only 접근만
✅ Destructive migration 자동 차단
✅ 모든 로그 자동 저장
✅ 실패 시 즉시 알림

---

## 🚀 배포 플로우 (최종)

```
Night QA PASS ✅
  ↓
Risk: LOW 판정
  ↓
Architect 검증
  ↓
Pre-deploy backup
  ↓
Prisma migrate deploy
  ↓
Health check
  ↓
✅ Deployment Complete
```

---

## 🎉 결론

**이제부터:**

1. ✅ 정적 분석만으로 판정하지 않음
2. ✅ 부하 테스트 결과를 반드시 포함
3. ✅ Architect 승인 필수
4. ✅ 자동화된 Night QA 시스템 운영
5. ✅ 명확한 배포 기준 준수

**배포 판정은 더 이상 "감"이 아니라 "시스템"이 한다.**

---

## 📅 다음 스텝

1. **2026-03-01 01:25 UTC**: Staging Load Test 완료 대기
2. **2026-03-01 02:00 UTC**: 결과 분석 + Architect 검증
3. **2026-03-02**: Night QA 시스템 GitHub Actions 구현
4. **매일 밤 11시**: 자동 검증 + 아침 리포트

---

**작성자**: Claude Haiku 4.5
**검증 상태**: Ralph Loop In Progress
**최종 승인**: 대기 (Architect verification required)
