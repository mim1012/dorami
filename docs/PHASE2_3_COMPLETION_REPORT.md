# Phase 2 백엔드 + Phase 3 구현 완료 보고서

## 작업 1: 배송문구 설정

### 백엔드
- `system_config` 테이블에 `shipping_messages` JSON 컬럼 추가 (Prisma schema + db push)
- `AdminService`에 `getShippingMessages()`, `updateShippingMessages()` 메서드 추가
  - 기본 메시지 템플릿 제공 (준비중/발송완료/배송중/배송완료)
  - 변수 지원: `{orderId}`, `{trackingNumber}`, `{customerName}`
- `AdminController`에 엔드포인트 추가:
  - `GET /api/admin/config/shipping-messages`
  - `PUT /api/admin/config/shipping-messages`

### 프론트엔드
- `ShippingMessages` 컴포넌트 생성 (`client-app/src/components/admin/settings/ShippingMessages.tsx`)
  - 배송 상태별 (준비중/발송완료/배송중/배송완료) 메시지 편집 UI
  - 변수 삽입 버튼 (커서 위치에 `{orderId}`, `{trackingNumber}`, `{customerName}` 삽입)
  - 미리보기 기능 (샘플 데이터로 변수 치환 후 표시)
  - 기본값 복원 기능
  - React Query 연동 (캐싱, invalidation)
- `admin/settings/page.tsx`에 ShippingMessages 컴포넌트 추가

## 작업 2: 독촉 알림 발송 채널 연결

### 알림 채널 우선순위 구현
- `NotificationsService`에 `PushNotificationService` 주입
- `sendPaymentReminderNotification()` 및 `sendShippingNotification()` 수정:
  - 1순위: 웹 푸시 (기존 `PushNotificationService` 활용, VAPID 기반)
  - 2순위: 카카오톡 (`KakaoTalkClient` fallback)
  - 웹 푸시 실패 시 자동으로 카카오톡으로 전환

### 입금 독촉 자동화
- `OrdersService`에 `sendPaymentReminders()` 크론 잡 추가
  - 스케줄: `@Cron('0 */6 * * *')` (6시간마다)
  - 조건: 주문 후 6시간 경과 + 미입금 (`paymentStatus: PENDING`)
  - Redis 기반 중복 발송 방지 (`order:reminder:{orderId}`, 24시간 TTL)
- `OrdersModule`에 `NotificationsModule` import 추가

## 작업 3: 카카오톡 공유

### 기존 구현 확인 및 개선
- `layout.tsx`: Kakao JS SDK v2.7.0 스크립트 이미 포함 (변경 불필요)
- `useKakaoShare.ts` 훅:
  - `shareOrder()` 함수를 `commerce` 타입 템플릿으로 변경
  - 주문번호, 은행 정보, 예금주, 입금자명, 입금 기한, 금액 표시
  - 입금 정보 확인 버튼 링크 포함
- `order-complete/page.tsx`: 카카오톡 공유 버튼 이미 구현됨 (변경 불필요)
  - SDK 초기화 전 비활성화, 초기화 후 활성화

### 환경 변수
- `NEXT_PUBLIC_KAKAO_JS_KEY`: 카카오 개발자 콘솔에서 JavaScript 키 발급 필요

## 작업 4: 비대칭 그리드

### 매거진 레이아웃
- `page.tsx`의 추천 상품 섹션 수정
  - 첫 번째 상품: `gridColumn: '1 / -1'`으로 2열 전체 사용 (featured)
  - 나머지 상품: 기존 2열 그리드 유지
  - 첫 번째 상품에 `size="normal"`, 나머지에 `size="small"` 적용

## 변경 파일 목록

### 백엔드
| 파일 | 변경 |
|------|------|
| `backend/prisma/schema.prisma` | `shippingMessages` 필드 추가 |
| `backend/src/modules/admin/admin.service.ts` | 배송문구 CRUD 메서드 추가 |
| `backend/src/modules/admin/admin.controller.ts` | 배송문구 엔드포인트 추가 |
| `backend/src/modules/notifications/notifications.service.ts` | 웹 푸시 우선순위 채널 구현 |
| `backend/src/modules/orders/orders.service.ts` | 입금 독촉 크론 잡 추가 |
| `backend/src/modules/orders/orders.module.ts` | NotificationsModule import |

### 프론트엔드
| 파일 | 변경 |
|------|------|
| `client-app/src/components/admin/settings/ShippingMessages.tsx` | 신규 생성 |
| `client-app/src/app/admin/settings/page.tsx` | ShippingMessages 컴포넌트 추가 |
| `client-app/src/hooks/useKakaoShare.ts` | commerce 템플릿으로 변경 |
| `client-app/src/app/page.tsx` | 비대칭 그리드 레이아웃 |

## 빌드 확인
- 백엔드 TypeScript 컴파일: 통과
- 프론트엔드 TypeScript 컴파일: 기존 에러만 존재 (shop/page.tsx의 pre-existing TS 경고), 이번 변경과 무관
