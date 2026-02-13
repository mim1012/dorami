# 도라미 중복 코드 검사 보고서

**작성일:** 2026-02-12  
**검사 범위:**
- Backend: `/Users/jhkim/projects/active/dorami/backend/src`
- Frontend: `/Users/jhkim/projects/active/dorami/client-app/src`

---

## 🎯 검사 결과 요약

### 통계
- **총 파일:** 516개 (TypeScript/TSX)
- **발견된 중복:** 3개 카테고리
- **심각도:** 중간 (즉시 수정 권장)

---

## ❌ 발견된 중복 코드

### 1. **Socket.IO Gateway 중복** (심각도: 높음)

#### 문제
`main.ts`에서 수동으로 구현한 Socket.IO Gateway와 원본 Gateway 파일들이 **동시에 존재**합니다.

#### 영향
- **메모리 낭비**: 같은 기능의 Gateway가 2번 실행됨
- **포트 충돌 위험**: 같은 namespace를 2개의 Gateway가 처리
- **혼란**: 어떤 Gateway가 실제로 작동하는지 불명확
- **유지보수 어려움**: 한 곳을 수정해도 다른 곳은 그대로

#### 중복 파일 목록

| 원본 Gateway 파일 | main.ts 통합 여부 | Module 등록 | 사용 중 |
|-------------------|-------------------|-------------|---------|
| `modules/chat/chat.gateway.ts` | ✅ 통합됨 | ✅ ChatModule | ❌ 미사용 (중복) |
| `modules/streaming/streaming.gateway.ts` | ✅ 통합됨 | ✅ StreamingModule | ❌ 미사용 (중복) |
| `modules/websocket/websocket.gateway.ts` | ✅ 통합됨 | ✅ WebsocketModule | ⚠️ **일부 사용** |
| `modules/product/product.gateway.ts` | ✅ 통합됨 | ✅ ProductModule | ⚠️ **일부 사용** |

#### 현재 상황
**main.ts에서 수동 구현:**
```typescript
// Manually create /chat namespace with full ChatGateway logic
const chatNamespace = io.of('/chat');
chatNamespace.use((socket, next) => { /* auth */ });
chatNamespace.on('connection', (socket) => { /* handlers */ });
```

**동시에 app.module.ts에서 모듈 import:**
```typescript
@Module({
  imports: [
    ChatModule,          // ← 중복!
    StreamingModule,     // ← 중복!
    WebsocketModule,     // ← 일부 사용됨 (handlers에서 inject)
    // ...
  ]
})
```

#### WebsocketGateway 특수 케이스
`WebsocketGateway`는 **다른 모듈에서 의존성으로 사용** 중:

**사용 위치:**
- `modules/websocket/handlers/order-alert.handler.ts`
- `modules/websocket/handlers/product-alert.handler.ts`
- `modules/websocket/handlers/admin-notification.handler.ts`
- `modules/products/listeners/product-events.listener.ts`

**코드 예시:**
```typescript
@Injectable()
export class OrderAlertHandler {
  constructor(private websocketGateway: WebsocketGateway) {}
  
  async sendOrderAlert(orderId: string) {
    this.websocketGateway.broadcast('order:created', { orderId });
  }
}
```

#### 해결 방안

##### 옵션 A: Gateway 파일 삭제 + main.ts만 사용 (권장)
1. **삭제할 파일:**
   - `modules/chat/chat.gateway.ts`
   - `modules/streaming/streaming.gateway.ts`
   - `modules/product/product.gateway.ts`
   - `modules/websocket/websocket.gateway.ts`

2. **app.module.ts 수정:**
   ```typescript
   @Module({
     imports: [
       // ChatModule 제거
       // StreamingModule 제거
       // WebsocketModule 제거
       // ProductModule은 유지 (다른 로직 있음)
     ]
   })
   ```

3. **의존성 주입 수정:**
   WebsocketGateway를 사용하는 handlers/listeners에서 `Server` 직접 주입:
   
   **Before:**
   ```typescript
   constructor(private websocketGateway: WebsocketGateway) {}
   this.websocketGateway.broadcast('event', data);
   ```
   
   **After:**
   ```typescript
   import { Inject } from '@nestjs/common';
   
   constructor(@Inject('SOCKET_IO_SERVER') private io: Server) {}
   this.io.emit('event', data);
   ```

4. **main.ts에 Provider 등록:**
   ```typescript
   app.useGlobalProviders([
     { provide: 'SOCKET_IO_SERVER', useValue: io }
   ]);
   ```

##### 옵션 B: main.ts 수동 구현 제거 + 원본 Gateway 사용
1. main.ts의 수동 Gateway 구현 모두 제거
2. 원본 Gateway 파일 사용
3. CustomIoAdapter 유지 (Redis adapter)

**장점:** 원본 파일 유지, NestJS 표준 방식  
**단점:** 프로덕션 설정 (환경 변수 검증, graceful shutdown 등) 재구현 필요

---

### 2. **Form 핸들링 패턴 중복** (심각도: 중간)

#### 문제
여러 페이지에서 **동일한 Form 상태 관리 패턴**이 반복됩니다.

#### 중복 발생 위치
- `app/profile/register/page.tsx` (10,157 bytes)
- `app/admin/products/page.tsx` (FormData 패턴)
- `app/admin/orders/bulk-notify/page.tsx` (FormData 패턴)

#### 중복 패턴
```typescript
// 모든 페이지에서 반복되는 패턴
const [formData, setFormData] = useState<FormData>({ ... });
const [errors, setErrors] = useState<FormErrors>({ ... });
const [isSubmitting, setIsSubmitting] = useState(false);

const handleChange = (e) => {
  setFormData({ ...formData, [name]: value });
  if (errors[name]) {
    setErrors({ ...errors, [name]: undefined });
  }
};

const validateForm = () => { /* 각 페이지마다 다른 검증 로직 */ };

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;
  setIsSubmitting(true);
  try {
    await apiClient.post(...);
  } catch (error) { ... }
  finally { setIsSubmitting(false); }
};
```

#### 해결 방안
**Custom Hook 생성:**
```typescript
// src/lib/hooks/use-form.ts
export function useForm<T>({
  initialData,
  validate,
  onSubmit,
}: {
  initialData: T;
  validate: (data: T) => Record<string, string>;
  onSubmit: (data: T) => Promise<void>;
}) {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (name: keyof T, value: any) => {
    setFormData({ ...formData, [name]: value });
    if (errors[name as string]) {
      setErrors({ ...errors, [name as string]: undefined });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      // Error handling
    } finally {
      setIsSubmitting(false);
    }
  };

  return { formData, errors, isSubmitting, handleChange, handleSubmit, setFormData };
}
```

**사용 예시:**
```typescript
// profile/register/page.tsx
const { formData, errors, isSubmitting, handleChange, handleSubmit } = useForm({
  initialData: { depositorName: '', instagramId: '', ... },
  validate: (data) => {
    const errors: FormErrors = {};
    if (!data.depositorName) errors.depositorName = '입금자명을 입력해주세요';
    // ...
    return errors;
  },
  onSubmit: async (data) => {
    await apiClient.post('/users/complete-profile', data);
    router.push('/');
  },
});
```

---

### 3. **Prisma Query 패턴 중복** (심각도: 낮음)

#### 문제
`findUnique` 패턴이 여러 service에서 반복됩니다.

#### 통계
- **총 Prisma 호출:** 222개
- **findUnique({ where: { id } }) 패턴:** 약 40개

#### 현재 해결 방법
`findOrThrow` 유틸리티 사용 (좋은 패턴):
```typescript
await findOrThrow(
  this.prisma.product.findUnique({ where: { id } }),
  'Product',
  id
);
```

#### 개선 제안
없음. 현재 `findOrThrow` 패턴이 충분히 효율적입니다.

---

## ✅ 중복이 없는 영역

### 1. API Client
- ✅ `lib/api/client.ts` 단일 파일로 통합
- ✅ CSRF 토큰 관리
- ✅ Token refresh 로직
- ✅ FormData vs JSON 자동 처리

### 2. 유틸리티 함수
- ✅ `lib/utils/format.ts` 단일 파일
- ✅ 4개 함수만 export (formatPhoneNumber, formatZipCode, formatInstagramId, formatPrice)

### 3. 컴포넌트
- ✅ 모든 컴포넌트 이름 고유
- ✅ 중복된 컴포넌트 없음

### 4. 상수
- ✅ `lib/constants/us-states.ts` 단일 파일

---

## 📊 우선순위별 수정 계획

### 우선순위 1 (즉시 수정 권장)
**Socket.IO Gateway 중복 제거**

**예상 작업 시간:** 2시간  
**난이도:** 중간

**작업 단계:**
1. `WebsocketGateway` 의존성 제거
   - handlers/listeners에서 `@Inject('SOCKET_IO_SERVER')` 사용
2. Gateway 파일 삭제
   ```bash
   rm modules/chat/chat.gateway.ts
   rm modules/streaming/streaming.gateway.ts
   rm modules/product/product.gateway.ts
   rm modules/websocket/websocket.gateway.ts
   ```
3. Module imports 제거
   - `app.module.ts`에서 ChatModule, StreamingModule, WebsocketModule 제거
4. Provider 등록
   - main.ts에 `SOCKET_IO_SERVER` provider 추가
5. 테스트
   - E2E 테스트 실행 확인

### 우선순위 2 (권장)
**Form 핸들링 Hook 생성**

**예상 작업 시간:** 3시간  
**난이도:** 낮음

**작업 단계:**
1. `lib/hooks/use-form.ts` 생성
2. 기존 페이지 리팩토링
   - `profile/register/page.tsx`
   - `admin/products/page.tsx`
   - `admin/orders/bulk-notify/page.tsx`
3. 테스트

### 우선순위 3 (선택)
**Prisma Query 헬퍼 확장**

현재 `findOrThrow`가 충분히 효율적이므로 **수정 불필요**.

---

## 🎯 기대 효과

### Socket.IO Gateway 중복 제거 후
- **메모리 사용량:** ~30% 감소 (Gateway 인스턴스 절반으로)
- **코드 라인 수:** ~800줄 제거
- **유지보수성:** 단일 소스로 관리 (main.ts만 수정)
- **명확성:** 어떤 Gateway가 작동하는지 명확

### Form Hook 도입 후
- **코드 재사용:** ~200줄 감소
- **일관성:** 모든 Form이 동일한 패턴 사용
- **테스트 용이:** Hook 단위 테스트 가능

---

## 📝 권장 사항

### 즉시 조치
1. **Socket.IO Gateway 중복 제거**
   - main.ts 수동 구현 유지 (프로덕션 기능 포함)
   - 원본 Gateway 파일 삭제
   - WebsocketGateway 의존성 → Server 직접 주입으로 변경

### 점진적 개선
2. **Form Hook 생성 및 적용**
   - 새 페이지부터 `useForm` hook 사용
   - 기존 페이지는 리팩토링 시 적용

### 유지
3. **API Client 및 유틸리티는 현재 구조 유지**
   - 이미 잘 구조화되어 있음

---

## 🔍 추가 확인 필요

### 프로필 등록 페이지
- ✅ **완전히 구현되어 있음** (`/app/profile/register/page.tsx`)
- ✅ 입금자명, 인스타그램 ID, 미국 배송지 모두 포함
- ✅ 실시간 유효성 검사
- ✅ 인스타그램 ID 중복 확인

**결론:** 카카오 연동 테스트에서 "프로필 등록 페이지 없음"은 **오탐**. 페이지는 이미 완전히 구현되어 있습니다.

---

## 📈 다음 단계

1. **Socket.IO Gateway 중복 제거** (2시간)
2. **E2E 테스트 재실행** (30분)
3. **Form Hook 생성** (3시간, 선택)
4. **Git 커밋**

---

**검사 완료 시각:** 2026-02-12 16:35 PST  
**검사자:** 제임스 (AI 비서)  
**승인 상태:** ⚠️ Socket.IO Gateway 중복 제거 권장
