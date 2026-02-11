# 카카오톡 공유 기능 구현 가이드

## 개요

주문 완료 후 입금 정보를 카카오톡으로 간편하게 공유할 수 있는 기능을 구현했습니다.

## 구현 범위

### 프론트엔드

- **Kakao SDK 통합**: layout.tsx에 SDK 로드
- **useKakaoShare Hook**: 카카오톡 공유 기능 추상화
- **Order Complete 페이지**: 공유 버튼 통합

### 기능

1. **주문 정보 공유**
   - 주문번호, 총 금액, 입금자명
   - 은행, 계좌번호, 예금주
   - 입금 기한
   - 주문 상품 목록 (최대 3개)

2. **라이브 스트림 공유** (확장 가능)
   - 라이브 제목, 썸네일
   - 라이브 페이지 링크

---

## 환경 설정

### 1. Kakao Developers 설정

#### 애플리케이션 생성

1. https://developers.kakao.com/ 접속
2. 로그인 후 "내 애플리케이션" 클릭
3. "애플리케이션 추가하기" 클릭
4. 앱 이름 입력 (예: "라이브 커머스")
5. 사업자명 입력 (예: "개인")

#### JavaScript 키 발급

1. 생성된 앱 선택
2. "요약 정보" 탭에서 JavaScript 키 복사
   - 형식: `12345678901234567890123456789012`

#### 플랫폼 설정

1. "플랫폼" 탭 클릭
2. "Web 플랫폼 등록" 클릭
3. 사이트 도메인 입력:
   - 개발: `http://localhost:3000`
   - 운영: `https://yourdomain.com`
4. 저장

#### 카카오 링크 활성화

1. "제품 설정" → "카카오 로그인" 클릭
2. "활성화 설정" ON
3. "Redirect URI" 등록 (선택사항)

### 2. 환경 변수 설정

#### 프론트엔드 (.env.local)

```bash
# Kakao JavaScript Key
NEXT_PUBLIC_KAKAO_JS_KEY=your_javascript_key_here
```

**⚠️ 보안 주의사항:**

- JavaScript 키는 공개키이므로 프론트엔드에 노출되어도 안전
- Admin 키는 절대 프론트엔드에 노출하지 마세요

---

## 사용 방법

### 1. 사용자 플로우

#### 주문 완료 후 카카오톡 공유

1. 주문 완료 페이지 진입
2. 입금 정보 확인
3. "카카오톡으로 입금 정보 받기" 버튼 클릭
4. 카카오톡 공유 창 열림
5. 친구/채팅방 선택
6. 메시지 전송

#### 공유된 메시지 형식

```
🎉 주문이 완료되었습니다!

주문번호: order-uuid
입금 기한: 2026년 2월 5일 오후 3시 30분

[상품 목록]
• 상품명 x 수량: 가격원 x 수량

총 50,000원
입금자명: 홍길동

[입금 정보 확인] [홈으로 이동]
```

### 2. 코드 사용 예시

#### 기본 사용법

```tsx
import { useKakaoShare } from '@/hooks/useKakaoShare';

function MyComponent() {
  const { isInitialized, shareOrder } = useKakaoShare();

  const handleShare = () => {
    shareOrder({
      orderId: 'order-123',
      totalAmount: 50000,
      depositorName: '홍길동',
      bankName: '국민은행',
      accountNumber: '123-456-789012',
      accountHolder: '라이브커머스(주)',
      deadlineDate: '2026년 2월 5일 오후 3:30',
      items: [
        { productName: '상품1', quantity: 2, price: 15000 },
        { productName: '상품2', quantity: 1, price: 20000 },
      ],
    });
  };

  return (
    <button onClick={handleShare} disabled={!isInitialized}>
      카카오톡 공유
    </button>
  );
}
```

#### 라이브 스트림 공유

```tsx
const { shareLiveStream } = useKakaoShare();

shareLiveStream({
  streamKey: 'stream-key-123',
  title: '🔥 특가 세일 라이브!',
  thumbnailUrl: 'https://example.com/thumbnail.jpg',
});
```

---

## 코드 구조

### useKakaoShare Hook

```typescript
// client-app/src/hooks/useKakaoShare.ts

export function useKakaoShare() {
  return {
    isInitialized: boolean;        // Kakao SDK 초기화 여부
    shareOrder: (data) => void;    // 주문 정보 공유
    shareLiveStream: (data) => void; // 라이브 스트림 공유
  };
}
```

### Kakao SDK 초기화

```tsx
// client-app/src/app/layout.tsx

<Script
  src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
  integrity="sha384-l+xbElFSnPZ2rOaPrU//2FF5B4LB8FiX5q4fXYTlfcG4PGpMkE1vcL7kNXI6Cci0"
  crossOrigin="anonymous"
  strategy="afterInteractive"
/>
```

### 공유 버튼 구현

```tsx
// client-app/src/app/order-complete/page.tsx

const { isInitialized, shareOrder } = useKakaoShare();

<button onClick={handleKakaoShare} disabled={!isInitialized}>
  {isInitialized ? '카카오톡으로 입금 정보 받기' : '카카오톡 로딩 중...'}
</button>;
```

---

## 카카오 링크 메시지 타입

### Feed 타입 (현재 사용)

```typescript
window.Kakao.Share.sendDefault({
  objectType: 'feed',
  content: {
    title: '제목',
    description: '설명',
    imageUrl: '이미지 URL',
    link: {
      mobileWebUrl: 'https://example.com/mobile',
      webUrl: 'https://example.com',
    },
  },
  itemContent: {
    profileText: '프로필 텍스트',
    items: [
      { item: '항목명', itemOp: '값' },
    ],
    sum: '합계',
    sumOp: '합계 설명',
  },
  buttons: [
    { title: '버튼명', link: {...} },
  ],
});
```

### 다른 타입 (확장 가능)

- **List**: 목록 형태
- **Location**: 위치 정보
- **Commerce**: 상품 정보
- **Text**: 텍스트만

---

## 브라우저 호환성

| 브라우저               | 데스크톱 | 모바일 |
| ---------------------- | -------- | ------ |
| Chrome                 | ✅       | ✅     |
| Safari                 | ✅       | ✅     |
| Firefox                | ✅       | ✅     |
| Edge                   | ✅       | ✅     |
| 카카오톡 인앱 브라우저 | ✅       | ✅     |

**모바일 동작:**

- 카카오톡 앱이 설치된 경우: 앱으로 이동
- 카카오톡 앱이 없는 경우: 웹 공유 페이지로 이동

---

## 디버깅

### Kakao SDK 로드 확인

```javascript
// 브라우저 콘솔에서 실행
console.log('Kakao SDK loaded:', typeof window.Kakao !== 'undefined');
console.log('Kakao initialized:', window.Kakao?.isInitialized());
```

### 공유 테스트

```javascript
// 간단한 테스트 메시지
window.Kakao.Share.sendDefault({
  objectType: 'text',
  text: '테스트 메시지',
  link: {
    mobileWebUrl: window.location.href,
    webUrl: window.location.href,
  },
});
```

### 에러 로그

- 브라우저 콘솔에서 `[useKakaoShare]` 접두사가 붙은 로그 확인
- Network 탭에서 Kakao SDK 로드 상태 확인

---

## 문제 해결

### 1. "Kakao is not defined" 에러

**원인:** Kakao SDK가 로드되지 않음
**해결:**

- `layout.tsx`에 Script 태그 추가 확인
- 네트워크 탭에서 SDK 로드 확인
- `strategy="afterInteractive"` 설정 확인

### 2. "Invalid appKey" 에러

**원인:** JavaScript 키가 잘못됨
**해결:**

- `.env.local` 파일에 올바른 키 입력
- Kakao Developers 콘솔에서 키 재확인
- 앱 재시작 (`npm run dev` 재실행)

### 3. "Platform 등록 필요" 에러

**원인:** 현재 도메인이 Kakao 플랫폼에 등록되지 않음
**해결:**

- Kakao Developers → 플랫폼 → Web 플랫폼 등록
- `http://localhost:3000` 또는 운영 도메인 추가

### 4. 공유 창이 열리지 않음

**원인:** 팝업 차단
**해결:**

- 브라우저 설정에서 팝업 허용
- 사용자 액션(클릭)에서만 공유 실행

### 5. 모바일에서 앱이 열리지 않음

**원인:** 카카오톡 미설치 또는 버전 문제
**해결:**

- 카카오톡 최신 버전 설치
- 앱 미설치 시 웹 공유 페이지 제공

---

## TODO: 추가 개선 사항

### 높은 우선순위

1. **커스텀 이미지**
   - 주문 상품 이미지를 공유 메시지에 포함
   - 현재는 기본 이미지 사용

2. **딥링크 개선**
   - 카카오톡에서 메시지 클릭 시 앱 내 특정 페이지로 이동
   - Universal Link 또는 App Link 설정

3. **공유 통계**
   - 얼마나 많은 사용자가 공유했는지 추적
   - 전환율 측정

### 낮은 우선순위

4. **다양한 메시지 템플릿**
   - 상황별 (주문 완료, 배송 시작, 라이브 시작) 다른 템플릿
   - 관리자 페이지에서 템플릿 커스터마이징

5. **다른 플랫폼 공유**
   - 페이스북, 트위터, 라인 공유
   - Web Share API 활용

---

## 참고 자료

- [Kakao Developers](https://developers.kakao.com/)
- [카카오 링크 API 문서](https://developers.kakao.com/docs/latest/ko/message/js-link)
- [JavaScript SDK 문서](https://developers.kakao.com/docs/latest/ko/sdk-download/js)
- [메시지 템플릿 가이드](https://developers.kakao.com/docs/latest/ko/message/message-template)

---

**작성일:** 2026-02-04
**구현자:** Claude
**테스트 상태:** 미완료 (Kakao JS Key 필요)
