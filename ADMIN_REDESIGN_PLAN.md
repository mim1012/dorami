# 🎨 Dorami Admin 페이지 재구성 계획

## Fashion Platform 디자인 기반

**작성일**: 2026-02-28
**상태**: ✅ 색상 확정 + 팀 구성 중
**색상**: #FF4D8D (Fashion Platform으로 통일) ✅
**참고**: Fashion Platform 홈화면 docs 디자인
**팀**: 다중 에이전트 병렬 구현

---

## 📊 변경 사항 요약

| 항목         | 현재                 | → 변경될 것                    | 상세                       |
| ------------ | -------------------- | ------------------------------ | -------------------------- |
| **배경색**   | Light (white/F8F9FA) | ✅ Light (white/gray-50) 유지  | Fashion Platform과 동일    |
| **텍스트색** | Dark                 | ✅ Dark 유지                   | 일관성 유지                |
| **주 색상**  | Hot Pink (#FF1493)   | 📌 #FF4D8D (Fashion) 또는 유지 | 결정 필요                  |
| **Sidebar**  | 좌측 고정 (w-64)     | ✅ 좌측 고정 (240px)           | 동일 크기, 더 나은 스타일  |
| **Header**   | 기본 헤더            | ✅ Search + Notifications      | 새로운 기능 추가           |
| **컴포넌트** | 커스텀               | 📌 Radix UI 패턴 참고          | hover, shadow, border 개선 |
| **레이아웃** | Flex                 | ✅ Flex + 반응형 Grid          | md/lg breakpoints 추가     |

---

## 🎯 색상 시스템

### Primary Colors

```css
/* Fashion Platform */
--primary-pink: #ff4d8d /* 부드러운 핑크 */ --secondary-purple: #b084cc /* 보라색 */
  /* dorami 기존 */ --hot-pink: #ff1493 /* 더 진한 핑크 */ /* 권장: dorami 유지 또는 Fashion 통합 */;
```

### Status Colors (Semantic)

```css
--status-live: #ef4444 (Red-500) /* 방송중/에러 */ --status-paid: #22c55e (Green-500)
  /* 완료/성공 */ --status-pending: #eab308 (Yellow-500) /* 대기중 */ --status-scheduled: #3b82f6
  (Blue-500) /* 예정 */ /* 배경색 */ --bg-live: #fee2e2 (Red-50) --bg-paid: #dcfce7 (Green-50)
  --bg-pending: #fefce8 (Yellow-50) --bg-scheduled: #eff6ff (Blue-50);
```

### Neutral Colors

```css
--bg-primary: #ffffff --bg-secondary: #f3f4f6 (Gray-100) --bg-tertiary: #f9fafb (Gray-50)
  --text-primary: #111827 (Gray-900) --text-secondary: #6b7280 (Gray-600) --border: #e5e7eb
  (Gray-200);
```

---

## 🏗️ 레이아웃 구조

### AdminLayout 구조

```
AdminLayout
├── Sidebar (240px 고정)
│   ├── Logo & Brand (h-16)
│   ├── Home Link
│   ├── Navigation Menu (9개 항목)
│   └── Footer (version)
├── Main Content Area
│   ├── Header (h-16 고정)
│   │   ├── Search Bar (max-w-md)
│   │   ├── Live Indicator (선택사항)
│   │   ├── Notifications
│   │   └── Admin Profile
│   └── Page Content (pt-16)
│       ├── Page Header (h1 + description)
│       ├── Content Grid (반응형)
│       └── Footer
```

### 반응형 Breakpoints

```tailwind
/* Mobile First */
grid-cols-1              /* 모든 화면 기본 */
md:grid-cols-2           /* 768px 이상 */
lg:grid-cols-3 lg:grid-cols-4 /* 1024px 이상 */

/* Padding */
p-4                      /* 모바일: 16px */
md:p-6                   /* 태블릿: 24px */
lg:p-8                   /* 데스크톱: 32px */

/* Typography */
text-xl md:text-2xl lg:text-3xl
text-sm md:text-base lg:text-lg
```

---

## 🧩 컴포넌트 패턴

### 1. KPI Cards

Fashion Platform 패턴 적용:

```tsx
// 구조
- Icon (colored background)
- Label
- Value
- Change Indicator (+12.5%)
- Hover effect (shadow-md)
```

**Tailwind 클래스**:

```
bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 hover:shadow-md
```

### 2. Status Badges

Semantic colors with background:

```tsx
// 상태별 클래스
live:     bg-red-100 text-red-700
paid:     bg-green-100 text-green-700
pending:  bg-yellow-100 text-yellow-700
scheduled: bg-blue-100 text-blue-700
```

**Tailwind**:

```
px-2 md:px-3 py-1 rounded-full text-xs font-semibold
```

### 3. Data Tables

```tsx
// 가로 스크롤 지원
<div className="overflow-x-auto">
  <table className="w-full">
    {/* 컨텐츠 */}
  </table>
</div>

// 행 스타일
hover:bg-gray-50 transition-colors
```

### 4. Cards & Containers

```
bg-white rounded-xl shadow-sm border border-gray-100
p-4 md:p-6 lg:p-8
```

### 5. Buttons

```tsx
// Primary
bg-[#FF4D8D] text-white rounded-lg px-4 py-2 hover:bg-pink-600

// Secondary
border border-gray-200 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50

// Ghost
text-gray-700 hover:bg-gray-100 rounded-lg px-4 py-2
```

### 6. Input Fields

```
bg-gray-50 border border-gray-200 rounded-lg
focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D]
```

---

## 📄 페이지별 재구성 가이드

### Phase 1: Layout Components

#### AdminLayout.tsx

```tsx
변경 사항:
- pt-16 추가 (고정 헤더 공간)
- ml-[240px] 추가 (사이드바 공간)
- bg-gray-50 적용

기존:
<div className="admin-layout.flex.min-h-screen.bg-primary-black">

변경:
<div className="flex min-h-screen bg-gray-50">
  <Sidebar />
  <div className="flex-1 ml-[240px]">
    <Header />
    <main className="pt-16">
      <Outlet />
    </main>
  </div>
</div>
```

#### Sidebar.tsx

```tsx
변경 사항:
- w-64 → w-[240px] (명시적)
- bg-white 추가
- border-r border-gray-200 추가
- 메뉴 아이템에 hover 효과 추가

NavLink className:
기존: "text-gray-600 hover:text-hot-pink"
변경: "text-gray-700 hover:bg-gray-50 active:bg-pink-50 active:text-[#FF4D8D]"
```

#### Header.tsx

```tsx
새로 추가할 기능:
1. Search Bar
   - placeholder: "상품, 주문, 고객 검색..."
   - bg-gray-50 border border-gray-200
   - focus:ring-2 focus:ring-pink-100

2. Live Indicator (선택사항)
   - "LIVE" 뱃지 with pulsing dot

3. Notifications
   - Bell icon with red dot

4. Admin Profile
   - Avatar + Name + Email
   - Dropdown menu
```

---

### Phase 2: Dashboard 페이지

#### Dashboard 구성요소

```tsx
1. Page Header
   - h1: "대시보드"
   - p: "라이브커머스 운영 현황을 한눈에 확인하세요"

2. KPI Cards (4개)
   - 오늘 매출 (TrendingUp icon, pink)
   - 실시간 시청자 (Users icon, blue)
   - 오늘 주문 (ShoppingBag icon, green)
   - 평균 전환율 (Percent icon, purple)

3. Live Streams Section (2/3 width)
   - 제목, 상태 뱃지, 시청자/판매액
   - 호버 효과 (bg-gray-50)

4. Recent Orders Section (1/3 width)
   - 주문 ID, 고객명, 상품, 금액, 상태
   - 시간정보
```

---

### Phase 3: Data Pages (Orders, Products, Users)

#### 공통 패턴

```tsx
// 페이지 구조
<div className="p-4 md:p-6 lg:p-8">
  {/* 페이지 헤더 */}
  <div className="mb-6 md:mb-8">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">제목</h1>
    <p className="text-sm md:text-base text-gray-600">설명</p>
  </div>

  {/* 필터/검색 패널 */}
  <div className="bg-white rounded-xl p-4 md:p-6 mb-6 border border-gray-100">
    {/* 필터 컴포넌트 */}
  </div>

  {/* 데이터 테이블 */}
  <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
    <table className="w-full">{/* 테이블 컨텐츠 */}</table>
  </div>

  {/* 페이지네이션 */}
  <Pagination />
</div>
```

#### 상태 배지 적용

```tsx
const statusConfig = {
  PENDING_PAYMENT: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '결제대기' },
  PAYMENT_CONFIRMED: { bg: 'bg-green-100', text: 'text-green-700', label: '결제완료' },
  SHIPPED: { bg: 'bg-blue-100', text: 'text-blue-700', label: '배송중' },
  DELIVERED: { bg: 'bg-green-100', text: 'text-green-700', label: '배송완료' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700', label: '취소' },
};
```

---

### Phase 4: Settings Pages

#### 설정 페이지 구조

```tsx
// 섹션별 나열
- 기본 설정 (카드 형태)
- 결제 설정 (인라인 편집)
- 배송 설정 (테이블)
- 알림 설정 (토글 + 입력)

// 저장 버튼
<button className="mt-6 px-6 py-3 bg-[#FF4D8D] text-white rounded-lg hover:bg-pink-600">
  저장하기
</button>
```

---

## 📋 상세 체크리스트

### Layout Components (Phase 1)

- [ ] AdminLayout.tsx 업데이트
  - [ ] ml-[240px] 추가
  - [ ] pt-16 추가
  - [ ] bg-gray-50 적용

- [ ] Sidebar.tsx 재구성
  - [ ] w-[240px] 명시적 지정
  - [ ] bg-white border-r border-gray-200 추가
  - [ ] 메뉴 아이템 hover/active 스타일 개선
  - [ ] 로고 부분 스타일 업데이트

- [ ] Header.tsx 재구성
  - [ ] Search Bar 추가
  - [ ] Live Indicator 추가
  - [ ] Notifications 구현
  - [ ] Admin Profile 드롭다운 추가

### Dashboard Page (Phase 2)

- [ ] KPI Cards 4개 구현
  - [ ] 아이콘별 색상 적용
  - [ ] change indicator 표시
  - [ ] hover:shadow-md 적용

- [ ] Live Streams Section
  - [ ] 상태 배지 (live/scheduled)
  - [ ] 시청자 수/판매액 표시
  - [ ] 호버 효과

- [ ] Recent Orders Section
  - [ ] 상태 배지 (paid/pending)
  - [ ] 주문 정보 레이아웃
  - [ ] 스크롤 지원

### Data Pages (Phase 3)

- [ ] Orders Page
  - [ ] 테이블 구조 개선
  - [ ] 상태 배지 적용
  - [ ] 필터 패널 개선

- [ ] Products Page
  - [ ] 그리드/테이블 레이아웃
  - [ ] 이미지 섬네일
  - [ ] 상태 표시

- [ ] Users Page
  - [ ] 사용자 목록 테이블
  - [ ] 상태 배지 (ACTIVE/SUSPENDED)
  - [ ] 행동 버튼

### Settings Pages (Phase 4)

- [ ] 설정 페이지 구조
  - [ ] 섹션별 카드 레이아웃
  - [ ] 저장 버튼
  - [ ] 성공 메시지

### Testing & Polish (Phase 5)

- [ ] 반응형 테스트 (mobile/tablet/desktop)
- [ ] 색상 대비 확인 (접근성)
- [ ] hover/active 상태 확인
- [ ] 로딩 상태 (skeleton)
- [ ] 에러 상태 처리

---

## 🎨 CSS 변수 업데이트

### globals.css에 추가할 색상

```css
/* Neutral */
:root {
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-900: #111827;

  /* Status */
  --red-50: #fee2e2;
  --red-100: #fee2e2;
  --red-500: #ef4444;
  --red-700: #b91c1c;

  --green-50: #dcfce7;
  --green-100: #dcfce7;
  --green-600: #16a34a;
  --green-700: #15803d;

  --blue-50: #eff6ff;
  --blue-100: #eff6ff;
  --blue-600: #2563eb;
  --blue-700: #1d4ed8;

  --yellow-50: #fefce8;
  --yellow-100: #fefce8;
  --yellow-500: #eab308;
  --yellow-700: #b45309;

  --purple-100: #f3e8ff;
  --purple-600: #9333ea;

  --pink-50: #fdf2f8;
  --pink-100: #fce7f3;
  --pink-600: #ec4899;
}
```

---

## 🔄 마이그레이션 경로

### 기존 클래스 → 새로운 클래스

```
bg-primary-black      → bg-white (main) / bg-gray-50 (page)
bg-content-bg         → bg-white / bg-gray-50
text-primary-text     → text-gray-900
text-secondary-text   → text-gray-600
border-color          → border-gray-200
bg-hot-pink           → bg-[#FF4D8D] (또는 유지)

hover:bg-hot-pink/10  → hover:bg-pink-50
text-hot-pink         → text-[#FF4D8D]
```

---

## 📦 API & Database

### 변경 없음 ✅

모든 기존 API 엔드포인트 재활용:

- `GET /api/admin/dashboard/stats`
- `GET /api/admin/orders`
- `GET /api/admin/users`
- 등등...

### DB 확장 예정 (선택사항)

```sql
-- 필요시 추가할 칼럼
ALTER TABLE AuditLog ADD COLUMN IF NOT EXISTS actionDetails JSON;
ALTER TABLE SystemConfig ADD COLUMN IF NOT EXISTS uiTheme VARCHAR(20);
```

---

## 🚀 구현 순서 & 일정

### Week 1

- **Day 1-2**: Layout Components (Sidebar, Header) - 2일
- **Day 3**: Dashboard 페이지 - 1일
- **Day 4**: Orders/Products/Users 기본 구조 - 1일
- **Day 5**: 반응형 테스트 & 버그 수정 - 1일

### Week 2

- **Day 6-7**: Settings 페이지들 - 2일
- **Day 8**: Broadcast/Settlement 페이지 - 1일
- **Day 9-10**: 통합 테스트 & 폴리시 - 2일

**총 기간**: 10일 (병렬 작업 시 5-7일)

---

## 📌 중요 참고사항

1. **색상 확정 필요**: Hot Pink #FF1493 유지 vs #FF4D8D로 통합?
2. **API 호출 방식**: 기존 TanStack Query 패턴 유지
3. **테스트**: E2E 테스트 업데이트 필요 (클래스명 변경)
4. **점진적 마이그레이션**: 페이지 하나씩 업데이트 권장
5. **백업**: 마이그레이션 전 현재 코드 스냅샷 저장

---

**다음 단계**:

1. 색상 확정
2. Layout Components 구현 시작
3. Dashboard 재구성
4. 나머지 페이지들 순차 적용
