# Plan 통합 노트 — Designer/Architect 산출물 반영 준비

**작성자**: Team Lead
**작성일**: 2026-02-28
**상태**: Designer/Architect 작업 대기 중

---

## 📋 현재 상황

### 완료된 작업 (Task #3)

✅ **PRISMA_MIGRATION_PLAN.md** (Executor 완료)

- LiveStream.description 필드 추가
- OrderItem productId 인덱스 추가
- Product streamKey+status 인덱스는 이미 존재 (변경 불필요)
- 마이그레이션 SQL, 성능 분석, Rollback 계획 완료

### 진행 중인 작업

⏳ **Task #1**: DESIGN_SYSTEM_ANALYSIS.md (Designer)
⏳ **Task #2**: DATABASE_STRUCTURE_ANALYSIS.md (Architect)

### 대기 중인 작업

⏳ **Task #4**: 최종 mainpage-admin-redesign.md (Planner, Task #1, #2 완료 후)

---

## 🔍 기존 Plan vs SWAGGER_VALIDATION_REPORT 비교

### 1. GET /api/streaming/active (라이브 배너)

**기존 Plan (mainpage-admin-redesign.md):**

```typescript
Response: {
  id, streamKey, title, description, status, startedAt,
  thumbnailUrl, host { id, name }, viewerCount,
  products { id, name, price, originalPrice, imageUrl, discountRate } | null
}
```

**SWAGGER_VALIDATION_REPORT 발견:**

- 엔드포인트 존재 ✅
- 응답 형식 확인 필요 (배열 vs 객체)
- **Decision**: 객체 반환 권장 (`{ items: [LiveStream], total: number }` 형식)

**Action**: Task #2 (Architect)에서 확인

---

### 2. GET /api/streaming/upcoming (곧 시작하는 라이브)

**기존 Plan:**

- 기본값: limit=4
- 응답: `{ items: LiveStream[], total: number }`

**SWAGGER_VALIDATION_REPORT 발견:**

- 엔드포인트 존재 ✅
- 현재 기본값: limit=3
- **Decision**: 4로 변경 권장

**Action**: 기본값 변경 (Task #4에서)

---

### 3. GET /api/products/live-deals (방송특가)

**기존 Plan:**

- 신규 엔드포인트
- 현재 LIVE 스트림의 상품 8개
- 정렬: 라이브 시작 역순 → 상품 등록순

**SWAGGER_VALIDATION_REPORT:**

- 미존재 ❌
- 현재 대체 방법: `GET /api/products?streamKey={streamKey}`
- **Decision**: 신규 엔드포인트 추가 필요

**Action**: Task #4에서 신규 API 스펙 확정

---

### 4. GET /api/products/popular (라이브 인기상품)

**기존 Plan:**

- 신규 엔드포인트
- 판매수 기준 인기상품 (라이브 무관)
- 페이지네이션: page-based

**SWAGGER_VALIDATION_REPORT:**

- 미존재 ❌
- 현재 대체: `GET /api/products/featured` (추천상품)
- **Decision**: 신규 엔드포인트 추가 필요

**Action**: Task #4에서 신규 API 스펙 확정

---

## 📊 Designer/Architect 산출물 활용 계획

### Task #1 결과 (DESIGN_SYSTEM_ANALYSIS.md) 활용

기존 Plan의 **Section A.4 (Component Specifications)** 업데이트:

- [ ] 컬러 팔레트 정의 (Tailwind CSS 매핑)
- [ ] 타이포그래피 스케일 (폰트 크기, 두께)
- [ ] Spacing 시스템 (패딩, 마진, 갭)
- [ ] 4개 섹션의 컴포넌트 구조 (with mockups)
- [ ] 반응형 디자인 (모바일, 태블릿, 데스크톱)
- [ ] 기존 dorami 디자인과의 병합 전략

**영향을 받을 섹션:**

- A.4: Component Specifications (7개 컴포넌트)
- Frontend `client-app/src/components/mainpage/` 파일 구조

---

### Task #2 결과 (DATABASE_STRUCTURE_ANALYSIS.md) 활용

기존 Plan의 **Section A (Main Page)** 업데이트:

- [ ] A.1: API 스펙 검증 및 확정
  - getActiveStreams() 응답 형식 확인
  - 신규 2개 API 스펙 최종화
  - 확장 2개 API의 응답 DTO 확정
- [ ] A.2: Prisma 스키마 확정 (migration 반영)
- [ ] A.3: 데이터 흐름 & 상태 관리 다이어그램 업데이트

**영향을 받을 섹션:**

- A.1: API 라우트 설계
- A.2: Prisma 스키마 변경
- A.3: Status 관리 및 데이터 흐름

---

## 🎯 Task #4 (최종 Plan 업데이트) 작업 항목

Task #1, #2 완료 후 Planner가 실행할 작업:

### A. 마이그레이션 반영

- [ ] PRISMA_MIGRATION_PLAN.md 결과 → A.2 스키마 섹션 통합
- [ ] LiveStream.description 필드 응답에 포함 확인
- [ ] OrderItem 인덱스가 성능에 미치는 영향 문서화

### B. 디자인 반영

- [ ] DESIGN_SYSTEM_ANALYSIS.md → A.4 Component Specifications 통합
- [ ] 컬러, 타이포그래피, 레이아웃을 Tailwind CSS로 매핑
- [ ] 7개 컴포넌트 스펙에 디자인 시스템 요소 추가

### C. API 분석 반영

- [ ] DATABASE_STRUCTURE_ANALYSIS.md → A.1 API 라우트 설계 통합
- [ ] 4개 엔드포인트의 최종 응답 DTO 확정
- [ ] 신규 2개 API의 Service 메서드 시그니처 확정

### D. SWAGGER 검증 반영

- [ ] SWAGGER_VALIDATION_REPORT 의사결정 반영
  - getActiveStreams() 응답 형식 결정
  - getUpcomingStreams() 기본값 4로 변경
  - 신규 2개 API 스펙 최종화

### E. 문서 최종화

- [ ] Executive Summary 업데이트
- [ ] Section A-D 모두 최신화
- [ ] Phase 0-4 로드맵 확정
- [ ] Risk Assessment 업데이트
- [ ] 병렬 에이전트 실행 준비 완료

---

## 📝 의사결정 필요 항목

Designer 완료 후:

- [ ] 라이트 모드 추가 vs 다크 테마만 유지 (기존 Plan)
- [ ] 신규 디자인 컬러와 기존 dorami Hot Pink의 병합 방식

Architect 완료 후:

- [ ] getActiveStreams() 응답 형식 (배열 vs 객체)
- [ ] 신규 2개 API의 페이지네이션 방식 (limit+offset vs page-based)

---

## 🔗 산출물 의존성

```
MAINPAGE_CONCEPTS.md (개념 정의)
    ↓
SWAGGER_VALIDATION_REPORT.md (기존 API 검증)
    ↓
PRISMA_MIGRATION_PLAN.md ✅ (Task #3 완료)
    ↓
DESIGN_SYSTEM_ANALYSIS.md ⏳ (Task #1 진행 중)
DATABASE_STRUCTURE_ANALYSIS.md ⏳ (Task #2 진행 중)
    ↓
mainpage-admin-redesign.md (최종 통합 계획, Task #4)
    ↓
병렬 에이전트 실행 준비 완료
```

---

## ✅ 최종 체크리스트 (Task #4에서)

Planner가 Task #4 완료 전 확인할 사항:

- [ ] 4개 API 엔드포인트 응답 DTO 확정
- [ ] 2개 신규 API의 Service 로직 스펙 작성
- [ ] 7개 컴포넌트의 Props/Hooks 스펙 작성
- [ ] Prisma 마이그레이션 반영 완료
- [ ] 병렬 실행 가능한 Phase별 의존성 정확함
- [ ] 모든 섹션이 일관성 있게 업데이트됨
- [ ] 다음 단계: 병렬 에이전트 실행 준비 완료

---

_이 문서는 Task #1, #2 결과를 Task #4에 통합하기 위한 준비 노트입니다._
