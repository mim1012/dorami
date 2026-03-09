# Admin CMS → 사용자 페이지 콘텐츠 노출 검증 테스트

## 목적

어드민이 CMS에서 등록한 콘텐츠(상품, 공지사항, 라이브 방송, 배너, 추천 상품)가
**사용자 화면에 실제로 표시되는지** end-to-end로 검증합니다.

---

## 실행 방법

```bash
cd client-app

# 기본 (로컬 개발)
PLAYWRIGHT_BASE_URL=http://localhost:3003 \
BACKEND_URL=http://127.0.0.1:3001 \
  npx playwright test --project=admin e2e/admin-cms-content-visibility.spec.ts

# UI 모드 (브라우저에서 단계별 확인)
npx playwright test --project=admin e2e/admin-cms-content-visibility.spec.ts --ui
```

> **사전 조건**: 백엔드(3001)와 프론트엔드(3003)가 실행 중이어야 합니다.

---

## 테스트 구성 (7개)

### 테스트 1 — 상품 등록 후 Shop 페이지 노출

**흐름**

1. 어드민 `/admin/products` 페이지 접근
2. API로 테스트 상품 생성 (`POST /api/products`)
3. 어드민 목록에 상품이 나타나는지 확인
4. 사용자 `/shop` 페이지에서 상품명이 보이는지 확인
5. 가격 텍스트가 표시되는지 확인
6. 상품 클릭 후 상세 설명이 표시되는지 확인
7. 홈 페이지 인기 상품 섹션에서도 노출되는지 확인

**검증 항목**

| 검증                  | 방법                   | 예상 결과   |
| --------------------- | ---------------------- | ----------- |
| 어드민 상품 관리 접근 | 페이지 로드 성공       | PASS        |
| 상품 API 생성         | HTTP 201 응답, id 반환 | PASS        |
| 어드민 목록 노출      | 상품명 텍스트 존재     | PASS        |
| Shop 페이지 상품명    | 텍스트 검색            | PASS / FAIL |
| 가격 표시             | `$39.99` 텍스트        | PASS / SKIP |
| 상세 설명 표시        | 클릭 후 본문 텍스트    | PASS / SKIP |

---

### 테스트 2 — 공지사항 등록 후 Alerts 페이지 노출

**흐름**

1. API로 공지사항 생성 (`POST /api/notices/admin`, category: IMPORTANT)
2. 사용자 `/alerts` 페이지에서 공지 제목이 보이는지 확인
3. 클릭 후 본문 내용이 표시되는지 확인

**검증 항목**

| 검증                    | 방법           | 예상 결과   |
| ----------------------- | -------------- | ----------- |
| 공지사항 API 생성       | HTTP 201 응답  | PASS        |
| Alerts 페이지 제목 노출 | 텍스트 검색    | PASS / FAIL |
| 본문 내용 표시          | 클릭 후 텍스트 | PASS / SKIP |

> 테스트 종료 후 생성된 공지사항은 자동으로 삭제됩니다.

---

### 테스트 3 — 라이브 방송 등록 후 홈 / Upcoming 페이지 노출

**흐름**

1. 어드민 `/admin/live-management` 및 `/admin/broadcasts` 접근 확인
2. API로 예정 라이브 생성 (`POST /api/streaming/start`, scheduledAt: 내일)
3. 홈 페이지 예정 라이브 섹션 확인
4. `/upcoming` 페이지에서 방송 제목 확인

**검증 항목**

| 검증                    | 방법             | 예상 결과   |
| ----------------------- | ---------------- | ----------- |
| 라이브 관리 페이지 접근 | 페이지 로드      | PASS        |
| 방송 API 생성           | HTTP 응답        | PASS / FAIL |
| 홈 예정 라이브 섹션     | 방송 제목 텍스트 | PASS / SKIP |
| `/upcoming` 페이지 노출 | 방송 제목 텍스트 | PASS / FAIL |

---

### 테스트 4 — 마케팅 배너 설정 후 홈 노출

**흐름**

1. 어드민 `/admin/marketing` 접근
2. 기존 캠페인 목록 조회
3. 새 배너 항목 추가 (`PUT /api/admin/config/marketing-campaigns`)
4. 홈 페이지에서 배너 제목 노출 확인

**검증 항목**

| 검증                    | 방법             | 예상 결과   |
| ----------------------- | ---------------- | ----------- |
| 마케팅 관리 페이지 접근 | 페이지 로드      | PASS        |
| 배너 API 설정           | HTTP 응답        | PASS / FAIL |
| 홈 배너 노출            | 배너 제목 텍스트 | PASS / SKIP |

> SKIP이 나오는 경우: 홈 화면에 마케팅 배너 컴포넌트가 없거나 다른 조건(라이브 중)으로 숨겨진 경우

---

### 테스트 5 — 홈 추천 상품 설정 후 홈 노출

**흐름**

1. 어드민 `/admin/featured-products` 접근
2. 첫 번째 상품을 홈 추천 상품으로 설정 (`PUT /api/admin/config/home-featured-products`)
3. 홈 페이지에서 해당 상품 노출 확인

**검증 항목**

| 검증                  | 방법          | 예상 결과   |
| --------------------- | ------------- | ----------- |
| 피처드 상품 관리 접근 | 페이지 로드   | PASS        |
| 추천 상품 API 설정    | HTTP 응답     | PASS / FAIL |
| 홈 페이지 노출        | 상품명 텍스트 | PASS / SKIP |

---

### 테스트 6 — 어드민 전체 메뉴 접근 권한 검증

**흐름**
17개 어드민 페이지를 순차적으로 방문하여 403/로그인 리다이렉트 없이 정상 접근되는지 확인

**검증 대상 메뉴**

```
/admin/dashboard        대시보드
/admin/overview         개요
/admin/products         상품 관리
/admin/product-management
/admin/orders           주문 관리
/admin/order-management
/admin/users            고객 관리
/admin/customers
/admin/live-management  라이브 관리
/admin/broadcasts       방송 목록
/admin/featured-products 피처드 상품
/admin/marketing        마케팅
/admin/settlement       정산
/admin/analytics        분석
/admin/audit-log        감사 로그
/admin/payment-settings 결제 설정
/admin/settings         설정
```

**판단 기준**

- PASS: 해당 URL에서 페이지 정상 렌더링
- FAIL: `/login` 또는 `/403`으로 리다이렉트됨

---

### 테스트 7 — 이미지 표시 검증

**흐름**

1. `/shop` 페이지에서 상품 이미지 `<img>` 태그 탐색
2. `naturalWidth > 0` 으로 실제 로딩 완료 확인 (broken image 감지)
3. 홈 페이지 전체 이미지 개수 확인

**검증 항목**

| 검증                  | 방법                   | 예상 결과   |
| --------------------- | ---------------------- | ----------- |
| Shop 상품 이미지 로딩 | `img.naturalWidth > 0` | PASS / FAIL |
| 홈 이미지 렌더링      | img 개수 > 0           | PASS / SKIP |

---

## 결과 파일

테스트 실행 후 `client-app/test-results/cms-visibility/` 폴더에 자동 저장됩니다.

### JSON 결과 파일 (`results-{timestamp}.json`)

```json
{
  "runAt": "2026-03-07T11:00:00.000Z",
  "environment": {
    "backendUrl": "http://127.0.0.1:3001",
    "baseUrl": "http://localhost:3003"
  },
  "total": 30,
  "passed": 25,
  "failed": 2,
  "skipped": 3,
  "results": [
    {
      "item": "상품",
      "action": "사용자 Shop 페이지 노출",
      "status": "PASS",
      "detail": "id=abc123",
      "screenshotPath": "/path/to/product-shop-xxx.png",
      "timestamp": "2026-03-07T11:00:05.000Z"
    }
  ]
}
```

### 로그 파일 (`run-{timestamp}.log`)

타임스탬프가 붙은 실행 로그 (API 응답, 검증 결과 등)

### 스크린샷 (`*.png`)

각 검증 시점의 화면 캡처:

| 파일명                 | 설명                   |
| ---------------------- | ---------------------- |
| `product-shop-*.png`   | 상품 등록 후 Shop 화면 |
| `product-detail-*.png` | 상품 상세 시트         |
| `notice-alerts-*.png`  | 공지사항 Alerts 화면   |
| `live-home-*.png`      | 홈의 라이브 섹션       |
| `live-upcoming-*.png`  | /upcoming 화면         |
| `banner-home-*.png`    | 홈의 마케팅 배너       |
| `featured-home-*.png`  | 홈 추천 상품           |
| `menu-{이름}-*.png`    | 각 어드민 메뉴 화면    |
| `image-shop-*.png`     | Shop 이미지 검증 화면  |

---

## 결과 해석 가이드

| 상태    | 의미                                                        | 조치                       |
| ------- | ----------------------------------------------------------- | -------------------------- |
| ✅ PASS | 어드민 등록 → 사용자 화면 정상 노출                         | 없음                       |
| ❌ FAIL | 데이터가 화면에 없거나 API 오류                             | 버그 보고 필요             |
| ⏭️ SKIP | 기술적 이유로 검증 불가 (selector 불일치, 조건부 렌더링 등) | selector 확인 후 보완 가능 |

### SKIP이 많은 경우

SKIP은 실패가 아닙니다. 주로 다음 이유로 발생합니다:

- 홈 배너: 라이브 방송 중일 때만 배너 영역이 활성화되는 경우
- 상세 설명: 모달/시트가 열려야 텍스트가 보이는 경우
- 인기 상품 홈 노출: 정렬 알고리즘으로 인해 방금 등록한 상품이 1페이지에 없는 경우

---

## 주의사항

- **프로덕션에서 실행 금지**: 실제 DB에 테스트 데이터가 쓰여집니다
- **공지사항만 자동 삭제**: 상품·라이브 스트림은 수동으로 삭제 필요
- **라이브 API 실패 시**: `/api/streaming/start` 파라미터 형식을 백엔드 스펙과 맞춰야 할 수 있습니다
