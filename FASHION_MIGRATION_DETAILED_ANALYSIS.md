# Fashion Platform → Dorami 마이그레이션 정밀 분석

## 🎯 마이그레이션 방향: **Dorami 기술 스택 + Fashion Platform 디자인**

---

## 1️⃣ 백엔드 API 연동 분석

### 데이터 구조 호환성

#### Fashion Platform (현재)

```typescript
const products = [
  {
    id: 1,
    name: '핑크 스프링 드레스',
    price: 68000,
    originalPrice: 98000,
    discount: 31, // ⚠️ 백분율
    image: 'https://...', // ⚠️ image 필드
    endTime: Date.now() + 5 * 60 * 60 * 1000, // ⚠️ 타임스탠프
  },
];
```

#### Dorami API 응답 (실제)

```json
{
  "data": {
    "data": [
      {
        "id": "630c40c4-506c-43cb-973e-950f18cfd149",
        "name": "프리미엄 메이크업 브러시 12종",
        "price": 45000,
        "originalPrice": 60000,
        "discountRate": 25, // ✅ discountRate
        "imageUrl": "https://...", // ✅ imageUrl
        "status": "AVAILABLE", // ✅ 상태 필드
        "soldCount": 0, // ✅ 판매량
        "isNew": false, // ✅ 신상품 여부
        "createdAt": "2026-02-28T05:48:21.256Z"
      }
    ],
    "meta": {
      "total": 10,
      "page": 1,
      "limit": 8,
      "totalPages": 2
    }
  }
}
```

### 🔴 호환성 문제 3가지

#### Problem 1: 응답 구조 래핑

```typescript
// Fashion 기대: data = [...]
// Dorami 실제: data = { data: [...], meta: {...} }

// 해결책: unwrap 필요
const products = response.data.data;
```

#### Problem 2: 필드 이름 불일치

```typescript
// 리매핑 필요
discount → discountRate
image → imageUrl
```

#### Problem 3: endTime 필드 부재

```typescript
// Fashion: 판매 종료 시간 있음
// Dorami: scheduledAt (스트림 예약시간), createdAt, updatedAt만 있음

// 해결책: 타이머 제거 또는 백엔드 수정 필요
```

---

## 2️⃣ WebSocket 실시간 기능 분석

### Current State

```typescript
// Fashion: WebSocket 없음 (정적 Mock 데이터)
// Dorami: Socket.IO + Redis Adapter (3개 네임스페이스)
```

### Dorami WebSocket 구조

```typescript
// 백엔드 (main.ts)
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL },
  adapter: createAdapter(pubClient, subClient), // Redis
});

// 네임스페이스:
// 1. `/` - 스트림 이벤트 (stream:started, stream:ended, upcoming:updated)
// 2. `/chat` - 채팅
// 3. `/streaming` - 시청자 수 추적

// 프론트엔드 (use-mainpage.ts)
useEffect(() => {
  const ws = io(NEXT_PUBLIC_WS_URL, { withCredentials: true });

  ws.on('stream:started', () => {
    queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
  });

  ws.on('stream:ended', () => {
    queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
  });

  ws.on('upcoming:updated', () => {
    queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
  });

  return () => ws.disconnect();
}, [queryClient]);
```

### 🔴 마이그레이션 옵션

#### Option A: WebSocket 완전 통합 (권장)

- ✅ 실시간 업데이트
- ✅ Dorami 기술 스택 활용
- ⚠️ Socket.IO 클라이언트 설정 필요

#### Option B: Polling만 사용

- ✅ 간단
- ❌ 지연 시간 길고 서버 부하 증가

---

## 3️⃣ 인증/로그인 통합 분석

### Current State

```typescript
// Fashion: 인증 없음 (모든 라우트 Public)
// Dorami: Kakao OAuth + JWT (Token 쿠키 기반)
```

### Dorami 인증 흐름

```
사용자 → /auth/kakao → 카카오 로그인 → /auth/kakao/callback
→ JWT 발급 → 쿠키 설정 (accessToken, refreshToken)
→ 홈 또는 /profile/register로 리다이렉트
```

### Token 정보

```typescript
// HTTP-only 쿠키 자동 포함
accessToken: 15분 만료
refreshToken: 7일 만료

// apiClient가 자동으로 쿠키 포함
const response = await apiClient.get('/products/popular');
// 백그라운드: 만료 시 refreshToken으로 자동 갱신
```

### 🔴 Problem: Admin 접근 제어 부재

**Fashion Platform:**

```typescript
{
  path: '/admin',
  element: <AdminLayout />,  // 누구나 접근 가능 ❌
}
```

**필요 마이그레이션:**

```typescript
// 1️⃣ middleware.ts에서 보호
const PROTECTED_PATHS = ['/admin', '/orders', '/checkout'];

// 2️⃣ 또는 컴포넌트 레벨에서 보호
export default function AdminLayout() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" />;
  }

  return <AdminPages />;
}
```

---

## 📊 마이그레이션 계획

### 기본 원칙

```
✅ 기술 스택: Dorami 완전 승계
   - Next.js 16 App Router
   - TanStack Query (서버 상태)
   - Zustand (클라이언트 상태)
   - Socket.IO (WebSocket)
   - Kakao OAuth + JWT

✅ 디자인/화면: Fashion Platform 디자인 적용
   - Radix UI + Tailwind CSS 사용 (양쪽 모두 사용)
   - Fashion Platform의 색상 팔레트 (Warm Pink #FF4D8D)
   - Fashion Platform의 컴포넌트 레이아웃
```

### Phase별 작업

#### Phase 1: 라우팅 + 레이아웃 (1-2시간)

```
- [ ] React Router → Next.js App Router 변환
- [ ] `/admin` 라우트 구조 유지
- [ ] AdminLayout 적용 (Dorami 기반)
- [ ] 미들웨어 인증 추가
```

#### Phase 2: 컴포넌트 재구성 (3-4시간)

```
- [ ] Fashion 컴포넌트 복사 (79개)
- [ ] Dorami의 API 연동으로 변경
- [ ] 필드 이름 리매핑 (discount → discountRate 등)
- [ ] 응답 구조 unwrap 로직 추가
```

#### Phase 3: API 연동 (2-3시간)

```
- [ ] getMainPageData 구현 (스트림 + 상품)
- [ ] getPopularProducts 구현
- [ ] useMainPageData hook 적용
- [ ] 응답 타입 정의 (@live-commerce/shared-types)
```

#### Phase 4: WebSocket (1-2시간)

```
- [ ] Socket.IO 클라이언트 설정
- [ ] 이벤트 리스너 등록
- [ ] TanStack Query invalidation
```

#### Phase 5: 인증 통합 (1-2시간)

```
- [ ] Admin 라우트 미들웨어 보호
- [ ] useAuth() hook 적용
- [ ] Admin role 검증
```

#### Phase 6: 테스트 (2-3시간)

```
- [ ] MainPage: 데이터 로드 확인
- [ ] Admin: 로그인 필수 확인
- [ ] WebSocket: 실시간 업데이트
- [ ] 응답성 테스트
```

---

## ⚠️ 핵심 위험요소

### 1️⃣ API 응답 구조 미스매치

```
Risk Level: 🔴 높음
Impact: 페이지 로드 실패, 데이터 표시 안 됨
Mitigation: 응답 unwrap 로직 철저히 테스트
```

### 2️⃣ JWT 쿠키 자동 포함 메커니즘 이해 부족

```
Risk Level: 🔴 높음
Impact: 401 Unauthorized 에러, 인증 실패
Mitigation: apiClient 구현 정확히 파악
```

### 3️⃣ Admin 권한 검증 누락

```
Risk Level: 🟠 중간
Impact: 보안 취약점, 누구나 Admin 접근 가능
Mitigation: middleware + 컴포넌트 레벨 이중 검증
```

### 4️⃣ WebSocket 설정 복잡도

```
Risk Level: 🟠 중간
Impact: 실시간 기능 작동 안 함
Mitigation: Option B (Polling)로 폴백 가능
```

---

## 📈 예상 일정

```
Phase 1: 2-4시간 (라우팅 + 레이아웃)
Phase 2: 3-5시간 (컴포넌트 재구성)
Phase 3: 2-3시간 (API 연동)
Phase 4: 1-2시간 (WebSocket)
Phase 5: 1-2시간 (인증)
Phase 6: 2-3시간 (테스트)

총: 11-19시간 (1-2일)
```

---

## ✅ 최종 평가

| 항목          | 평가           |
| ------------- | -------------- |
| 기술적 가능성 | ✅ **가능**    |
| 복잡도        | 🔴 **중-높음** |
| 위험도        | 🟠 **중간**    |
| 권장여부      | ✅ **권장**    |

**이유:**

- Dorami의 완성된 백엔드 API 활용 가능
- Fashion Platform의 디자인 재사용 가능
- 기술 스택 정렬 (Both use Tailwind + Radix UI)

**주의사항:**

- API 응답 구조 철저히 검증
- JWT 쿠키 메커니즘 정확히 이해
- Admin 권한 검증 철저히
