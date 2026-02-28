# 메인페이지 주요 개념 정의 (2026-02-28)

## 🎯 메인페이지 4개 섹션 정의

### 1️⃣ 방송특가 (Live Exclusive Deals)

**정의**: 현재 **진행 중인 라이브 스트림에 연결된 상품들**

**데이터 출처:**

```
LiveStream (status = 'LIVE') → 연결된 Product[]
```

**필터링 조건:**

```sql
SELECT products.*
FROM products
INNER JOIN livestreams ON products.stream_key = livestreams.stream_key
WHERE livestreams.status = 'LIVE'
  AND products.status = 'AVAILABLE'
LIMIT 8
```

**정렬 기준**:

- Primary: 라이브 시작 시간 역순 (최신 라이브 먼저)
- Secondary: 상품 등록 순 (최신 상품)

**사용자 경험:**

- 현재 **보고 있는 라이브의 상품**
- 실시간으로 구매 가능
- 라이브 없으면 빈 섹션 또는 숨김

**API:**

```typescript
GET /api/products/live-deals
Response: Product[] (현재 LIVE 스트림에 연결된 상품들)

// 또는 현재 라이브 streamKey를 먼저 조회
GET /api/streaming/active
// 응답에 streamKey 포함
// 그 streamKey로 상품 조회
GET /api/products?streamKey={streamKey}
```

**예시:**

```
현재 라이브: "셀러A의 봄 신상품 페스티벌" (14:00~16:00)
└─ 상품1: 스프링 블라우스 (할인 30%)
└─ 상품2: 데님 팬츠 (할인 20%)
└─ 상품3: 가방 (신상품)
```

---

### 2️⃣ 라이브 인기상품 (Popular Products)

**정의**: **전체 상품 중 판매수가 많은 상품들** (라이브 무관)

**데이터 출처:**

```
Product[] → OrderItem 기반 판매수 집계
```

**필터링 조건:**

```sql
SELECT p.*, SUM(oi.quantity) as sold_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
  AND o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED')
WHERE p.status = 'AVAILABLE'
GROUP BY p.id
ORDER BY sold_count DESC
LIMIT 8
```

**정렬 기준**:

- Primary: 판매수 (내림차순)
- Secondary: 최신순 (같은 판매수면 최신 상품 먼저)

**사용자 경험:**

- **베스트셀러** 상품
- 다른 사람들이 많이 구매한 상품
- 신뢰도 높은 상품
- "더보기" 클릭 시 더 많은 인기상품 조회 가능

**API:**

```typescript
GET /api/products/popular?limit=8&page=0
Response: { products: Product[], meta: { total, page, totalPages } }

// 또는 기존 엔드포인트 수정
GET /api/products/featured?sort=popular
Response: Product[]
```

**예시:**

```
1. 스프링 코트 (판매 2,340개)
2. 데님 팬츠 (판매 1,890개)
3. 화이트 셔츠 (판매 1,650개)
4. 가방 (판매 1,200개)
...
```

---

### 3️⃣ 곧 시작하는 라이브 (Upcoming Lives)

**정의**: **앞으로 예정되어 있는 라이브 스트림들** (시간순)

**데이터 출처:**

```
LiveStream (status = 'PENDING' | 'OFFLINE' with scheduledAt in future)
```

**필터링 조건:**

```sql
SELECT livestreams.*
FROM livestreams
WHERE livestreams.status IN ('PENDING', 'OFFLINE')
  AND livestreams.scheduled_at > NOW()
ORDER BY livestreams.scheduled_at ASC
LIMIT 4
```

**정렬 기준**:

- Primary: 예정 시간 (가장 빠른 순)
- Secondary: 생성일 (최신 라이브 우선)

**사용자 경험:**

- **예정 라이브 카운트다운** 타이머
- 호스트 정보, 라이브 설명 표시
- 시작 시간이 가까워질수록 더 눈에 띄게
- 예정 라이브 없으면 "곧 시작 예정"이라는 안내

**데이터:**

```
{
  id: string
  streamKey: string
  title: string              // 라이브 제목
  description: string | null // 라이브 설명 (신규 필드)
  scheduledAt: ISO8601       // 예정 시작 시간
  thumbnailUrl: string | null // 라이브 썸네일
  host: { id, name }         // 호스트 정보
  isLive: boolean            // 현재 라이브 중인지
  durationUntilStart: number // 시작까지 남은 시간 (초)
}
```

**API:**

```typescript
GET /api/streaming/upcoming?limit=4
Response: {
  items: LiveStream[],
  total: number
}
```

**예시:**

```
1. "셀러B의 여름 신상품 런칭"
   └─ 예정: 오늘 18:00 (2시간 33분 남음)
   └─ 호스트: 셀러B

2. "셀러C의 쇼핑 라이브"
   └─ 예정: 내일 14:00 (26시간 33분 남음)
   └─ 호스트: 셀러C
```

---

### 4️⃣ 라이브 배너 (Live Hero Banner)

**정의**: **지금 진행 중인 라이브 스트림의 대표 배너**

**데이터 출처:**

```
LiveStream (status = 'LIVE')의 첫 번째 항목
```

**필터링 조건:**

```sql
SELECT livestreams.*
FROM livestreams
WHERE livestreams.status = 'LIVE'
LIMIT 1
```

**정렬 기준**:

- 현재 진행 중인 라이브 (최대 1개)

**사용자 경험:**

- **"지금 라이브 중"** 배너 (대형, 눈에 띄는)
- 실시간 시청자 수 표시
- 호스트 정보
- "보기" 버튼 → 라이브 페이지로 이동
- 라이브 없으면: 다음 예정 라이브 카운트다운으로 대체

**데이터:**

```
{
  id: string
  streamKey: string
  title: string
  viewerCount: number        // Redis 실시간
  thumbnailUrl: string | null
  startedAt: ISO8601
  host: { id, name }
  status: 'LIVE'
}
```

**API:**

```typescript
GET /api/streaming/active
Response: {
  items: [LiveStream],  // 최대 1개 (현재 LIVE만)
  total: number
}
```

**예시:**

```
┌─────────────────────────────┐
│ 🔴 지금 라이브 중!          │
│                             │
│ 셀러A의 봄 신상품 페스티벌  │
│ 👥 1,234명 시청 중         │
│                             │
│ [보러가기 →]               │
└─────────────────────────────┘
```

---

## 📊 4가지 섹션의 관계도

```
메인페이지
├─ 라이브 배너 (Live Hero Banner)
│  └─ 현재 LIVE인 스트림 1개
│     └─ viewerCount, 호스트, 제목
│
├─ 방송특가 (Live Exclusive Deals)
│  └─ 현재 LIVE 스트림의 상품들
│     └─ 라이브 없으면 숨김
│
├─ 곧 시작하는 라이브 (Upcoming Lives)
│  └─ 예정된 라이브 4개
│     └─ 카운트다운, 호스트, 설명
│
└─ 라이브 인기상품 (Popular Products)
   └─ 전체 상품 중 판매순 상위 8개
      └─ 라이브 무관, 항상 표시
```

---

## 🔄 상호작용 시나리오

### 시나리오 1: 라이브 진행 중

```
메인페이지 로드
│
├─ 라이브 배너: "셀러A 라이브" 표시 ✓
├─ 방송특가: 셀러A가 판매 중인 상품 8개 표시 ✓
├─ 곧 시작하는 라이브: "셀러B" (18:00) 등 표시 ✓
└─ 라이브 인기상품: 전체 베스트셀러 8개 표시 ✓

사용자가 "방송특가 상품" 클릭
└─ 해당 상품 상세 페이지 + 라이브 영상 재생 시작
```

### 시나리오 2: 라이브 없음

```
메인페이지 로드
│
├─ 라이브 배너: "곧 시작하는 라이브" 카운트다운 표시 ✓
│  └─ "셀러B, 2시간 33분 후 시작"
├─ 방송특가: 섹션 자체 숨김 ✗
├─ 곧 시작하는 라이브: 예정 라이브 4개 표시 ✓
└─ 라이브 인기상품: 전체 베스트셀러 8개 표시 ✓

사용자가 곧 시작하는 라이브에 "알림받기" 클릭
└─ 예정 시간에 Web Push 알림
```

---

## 💾 필요한 데이터 변경

| 항목                     | 변경 | 이유                               |
| ------------------------ | ---- | ---------------------------------- |
| `LiveStream.description` | 추가 | 곧 시작하는 라이브의 설명 표시     |
| `order_items` 인덱스     | 추가 | 라이브 인기상품의 판매수 집계 성능 |
| 기존 API                 | 확장 | 새 필드 추가 (backward compatible) |

---

## 🎨 UI 배치 (메인페이지)

```
┌────────────────────────────────┐
│       헤더 (로고, 검색)          │
└────────────────────────────────┘

┌────────────────────────────────┐
│   라이브 배너 (대형 히어로)      │
│   - 현재 라이브 또는 다음 예정   │
└────────────────────────────────┘

┌────────────────────────────────┐
│   방송특가 (수평 스크롤)         │
│   - 현재 라이브 상품만 8개      │
│   - 없으면 숨김                  │
└────────────────────────────────┘

┌────────────────────────────────┐
│   곧 시작하는 라이브 (슬라이더)  │
│   - 예정 라이브 4개             │
│   - 카운트다운 타이머            │
└────────────────────────────────┘

┌────────────────────────────────┐
│   라이브 인기상품 (그리드 2열)   │
│   - 베스트셀러 8개              │
│   - 더보기 버튼                  │
└────────────────────────────────┘

┌────────────────────────────────┐
│   푸터                          │
└────────────────────────────────┘
```

---

## 📋 구현 체크리스트

### Backend

- [ ] `LiveStream.description` 추가 (Prisma)
- [ ] `order_items` 인덱스 추가 (Prisma)
- [ ] `ProductsService.getLiveDeals()` 메서드 추가
- [ ] `ProductsService.getPopularProducts()` 메서드 추가
- [ ] `/api/products/live-deals` 라우트 추가
- [ ] `/api/products/popular` 라우트 추가 또는 기존 `/featured?sort=popular` 수정
- [ ] `/api/streaming/active` 응답 확장 (host, viewerCount)
- [ ] `/api/streaming/upcoming` 응답 확장 (description)

### Frontend

- [ ] `useMainPageData()` hook 또는 개별 호출
- [ ] `LiveHeroBanner` 컴포넌트
- [ ] `LiveExclusiveDeals` 컴포넌트
- [ ] `UpcomingLiveSlider` 컴포넌트
- [ ] `PopularProductGrid` 컴포넌트
- [ ] 각 섹션의 로딩/에러/빈 상태 처리

---

## 🔑 핵심 구분점

| 구분       | 방송특가                | 라이브 인기상품      | 곧 시작하는 라이브  |
| ---------- | ----------------------- | -------------------- | ------------------- |
| **범위**   | 현재 라이브에만 연결    | 전체 상품            | 예정된 라이브들     |
| **기준**   | 라이브 상품 연결        | 판매수               | 예정 시간순         |
| **무관**   | 라이브 없으면 숨김      | 라이브 여부 무관     | 라이브 진행 중 무관 |
| **갱신**   | 실시간 (상품 추가 시)   | 시간당 1회 (판매 시) | 시간당 1회 (스케줄) |
| **사용자** | 라이브 시청 중인 사용자 | 전체 사용자          | 전체 사용자         |

---

**이제 이 정의에 맞춰 구현하면 됩니다!** ✅
