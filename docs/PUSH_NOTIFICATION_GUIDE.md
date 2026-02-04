# Push Notification 구현 가이드

## 개요
사용자가 예정된 라이브 방송 알림을 받을 수 있도록 Web Push Notification 기능을 구현했습니다.

## 구현 범위

### 백엔드
- **Prisma Schema**: NotificationSubscription 모델 추가
- **NotificationsModule**: Push Notification 관련 서비스 및 컨트롤러
- **API 엔드포인트**:
  - `POST /api/notifications/subscribe` - 알림 구독
  - `DELETE /api/notifications/unsubscribe` - 알림 구독 취소
  - `GET /api/notifications/subscriptions` - 사용자 구독 목록 조회
- **Cron Job**: 5분마다 예정된 라이브 확인 (NotificationSchedulerService)
- **라이브러리**: `web-push`, `@nestjs/schedule`

### 프론트엔드
- **Service Worker**: `/public/sw.js` - Push 이벤트 처리 및 알림 표시
- **useNotifications Hook**: 알림 권한 요청 및 구독 관리
- **LiveCountdownBanner**: 알림받기 버튼 통합

---

## 환경 설정

### 1. VAPID 키 생성 (백엔드)

VAPID 키는 서버와 브라우저 간 안전한 통신을 위한 공개/비공개 키 쌍입니다.

```bash
cd backend
npx web-push generate-vapid-keys
```

**출력 예시:**
```
=======================================

Public Key:
BPxxxx...

Private Key:
yyyy...

=======================================
```

### 2. 환경 변수 설정

#### 백엔드 (.env)
```bash
# Push Notification VAPID Keys
VAPID_PUBLIC_KEY=BPxxxx...
VAPID_PRIVATE_KEY=yyyy...
VAPID_SUBJECT=mailto:admin@live-commerce.com
```

#### 프론트엔드 (.env.local)
```bash
# Push Notification Public Key (same as backend)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPxxxx...
```

**⚠️ 보안 주의사항:**
- Private Key는 절대 프론트엔드에 노출하지 마세요
- Public Key만 `NEXT_PUBLIC_` 접두사로 프론트엔드에 공유

---

## 데이터베이스 Migration

PostgreSQL이 실행 중일 때 migration을 적용하세요:

```bash
cd backend
npm run db:migrate
```

**Migration 내용:**
- `notification_subscriptions` 테이블 생성
- User/LiveStream 관계 설정
- 인덱스 추가

---

## 사용 방법

### 1. 사용자 플로우

#### 홈 화면에서 알림 설정
1. 홈 화면에서 "다음 라이브 방송까지" 카운트다운 표시
2. "알림받기" 버튼 클릭
3. 브라우저 알림 권한 요청 팝업 → "허용" 클릭
4. Service Worker 등록 및 Push 구독
5. 백엔드에 구독 정보 전송
6. 버튼 텍스트 변경: "알림 설정됨"

#### 알림 수신
1. 라이브 시작 5-10분 전, Cron Job이 예정된 스트림 확인
2. 구독자 전원에게 Push Notification 발송
3. 알림 클릭 시 해당 라이브 페이지로 이동

### 2. API 테스트 (Postman/cURL)

#### 알림 구독
```bash
curl -X POST http://localhost:3001/api/notifications/subscribe \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "liveStreamId": "stream-uuid-optional",
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "p256dh": "BNcRdreALRF...",
    "auth": "tBHSVfJWKo..."
  }'
```

**응답:**
```json
{
  "id": "subscription-uuid",
  "userId": "user-uuid",
  "liveStreamId": "stream-uuid",
  "createdAt": "2026-02-04T15:00:00.000Z"
}
```

#### 구독 목록 조회
```bash
curl -X GET http://localhost:3001/api/notifications/subscriptions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 구독 취소
```bash
curl -X DELETE http://localhost:3001/api/notifications/unsubscribe \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/..."
  }'
```

---

## 코드 구조

### 백엔드

#### PushNotificationService
```typescript
// backend/src/modules/notifications/push-notification.service.ts

@Injectable()
export class PushNotificationService {
  async subscribe(userId: string, dto: SubscribeNotificationDto);
  async unsubscribe(userId: string, endpoint: string);
  async sendLiveStartNotification(liveStreamId: string);
  async checkAndNotifyUpcomingStreams(); // Cron에서 호출
}
```

#### NotificationSchedulerService
```typescript
// backend/src/modules/notifications/notification-scheduler.service.ts

@Injectable()
export class NotificationSchedulerService {
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkUpcomingStreams() {
    await this.pushNotificationService.checkAndNotifyUpcomingStreams();
  }
}
```

### 프론트엔드

#### useNotifications Hook
```typescript
// client-app/src/hooks/useNotifications.ts

export function useNotifications() {
  return {
    isSupported: boolean;
    permission: NotificationPermission | null;
    isSubscribed: boolean;
    requestPermission: () => Promise<boolean>;
    subscribe: (liveStreamId?: string) => Promise<boolean>;
    unsubscribe: () => Promise<boolean>;
  };
}
```

#### LiveCountdownBanner 사용 예시
```tsx
<LiveCountdownBanner
  liveStartTime={nextLiveTime}
  isLive={false}
  liveStreamId="optional-stream-id"
  onLiveClick={() => router.push('/live/stream-key')}
/>
```

---

## 브라우저 호환성

| 브라우저 | Push Notification | Service Worker |
|---------|-------------------|----------------|
| Chrome 50+ | ✅ | ✅ |
| Firefox 44+ | ✅ | ✅ |
| Edge 17+ | ✅ | ✅ |
| Safari 16+ (macOS 13+) | ✅ | ✅ |
| iOS Safari | ❌ | ⚠️ (제한적) |

**iOS 제약사항:**
- iOS 16.4+ 필요
- Home Screen에 추가된 PWA에서만 작동
- 일반 Safari 브라우저에서는 미지원

---

## 디버깅

### 백엔드 로그 확인
```bash
# NotificationSchedulerService 로그
tail -f backend/backend-server.log | grep "Checking for upcoming"

# PushNotificationService 로그
tail -f backend/backend-server.log | grep "Notification sent"
```

### 프론트엔드 디버깅

#### Service Worker 상태 확인
1. Chrome DevTools → Application → Service Workers
2. 상태: "activated and is running"
3. Push 이벤트 테스트: "Push" 버튼 클릭

#### Push Subscription 확인
```javascript
// 브라우저 콘솔에서 실행
navigator.serviceWorker.ready.then(async (registration) => {
  const subscription = await registration.pushManager.getSubscription();
  console.log('Current subscription:', subscription);
});
```

#### 알림 권한 확인
```javascript
console.log('Notification permission:', Notification.permission);
```

---

## 문제 해결

### 1. "VAPID keys not configured" 경고
- `.env` 파일에 VAPID 키가 설정되지 않음
- `npx web-push generate-vapid-keys` 실행 후 환경 변수 추가

### 2. Service Worker 등록 실패
- `/public/sw.js` 파일 존재 확인
- HTTPS 또는 localhost 환경에서만 작동 (HTTP는 불가)
- 브라우저 콘솔에서 에러 메시지 확인

### 3. 알림 권한 거부됨
- 사용자가 "차단" 클릭한 경우
- 브라우저 설정에서 수동으로 권한 변경 필요
- Chrome: 설정 → 개인정보 및 보안 → 사이트 설정 → 알림

### 4. Push 구독 실패 (DOMException)
- VAPID Public Key가 유효하지 않음
- 백엔드와 프론트엔드의 키가 일치하는지 확인

### 5. Cron Job이 실행되지 않음
- `@nestjs/schedule` 모듈이 AppModule에 import되었는지 확인
- ScheduleModule.forRoot() 호출 확인

---

## TODO: 추가 개선 사항

### 높은 우선순위
1. **LiveStream 모델에 scheduledTime 필드 추가**
   - 현재는 PENDING 상태의 스트림만 확인
   - 정확한 시작 시간 기반 알림 필요

2. **알림 발송 기록 추가**
   - 중복 알림 방지
   - NotificationLog 테이블 생성

3. **알림 템플릿 커스터마이징**
   - 관리자 페이지에서 알림 메시지 편집
   - 다국어 지원

### 낮은 우선순위
4. **알림 선호도 설정**
   - 사용자별 알림 ON/OFF
   - 특정 스트리머만 구독

5. **통계 및 모니터링**
   - 알림 발송 성공률
   - 클릭률 (CTR) 추적

---

## 참고 자료
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [web-push 라이브러리](https://github.com/web-push-libs/web-push)
- [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling)

---

**작성일:** 2026-02-04
**구현자:** Claude
**테스트 상태:** 미완료 (DB migration 대기)
