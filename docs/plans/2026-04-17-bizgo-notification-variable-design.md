# Bizgo 알림톡/친구톡 변수 설계안

## 목표
- 알림톡 3종 + 친구톡 1종의 변수 정의를 한 곳에서 관리한다.
- 변수 목록과 실제 치환 로직이 어긋나지 않게 만든다.
- 결제 설정(SystemConfig)과 라이브 상세 정보가 템플릿에 자연스럽게 반영되게 한다.
- 운영자가 admin UI에서 변수 의미를 이해하고 테스트 발송까지 할 수 있게 한다.

## 대상 템플릿
1. ORDER_CONFIRMATION (친구톡 / FT)
2. PAYMENT_REMINDER (알림톡 / AT)
3. CART_EXPIRING (알림톡 / AT)
4. LIVE_START (알림톡 / AT)

---

## 권장 아키텍처

### 1) 변수 메타데이터 단일 소스
현재 `packages/shared-types/src/notification-variables.ts` 를 확장해서
단순 변수 이름 배열이 아니라 아래 메타를 담는다.

```ts
export type VariableSourceType = 'event' | 'system' | 'computed';

export interface NotificationVariableMeta {
  key: string;              // '#{주문번호}'
  label: string;            // '주문번호'
  description: string;      // 운영자 설명
  sourceType: VariableSourceType;
  sourcePath: string;       // 'order.id', 'system.storeName', 'computed.payment.label'
  required: boolean;
  sample: string;
}

export interface NotificationTemplateMeta {
  label: string;
  channel: 'AT' | 'FT';
  variables: NotificationVariableMeta[];
}
```

### 2) 백엔드 공통 렌더러
`backend/src/modules/admin/alimtalk.service.ts` 안의 `.replace()` 체인을 줄이고
공통 함수로 렌더링한다.

```ts
function renderTemplate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(key, value ?? ''),
    template,
  );
}
```

### 3) 템플릿별 변수 resolver
각 이벤트 타입별로 최종 변수 맵을 만든다.

예시:
- `buildOrderConfirmationVariables(context)`
- `buildPaymentReminderVariables(context)`
- `buildCartExpiringVariables(context)`
- `buildLiveStartVariables(context)`

이 resolver 가 아래 3계층을 합친다.
- event 데이터
- system settings
- computed 변수

### 4) settings는 원본값만 저장
SystemConfig 는 원본값 저장만 담당.
예:
- bankName
- bankAccountNumber
- bankAccountHolder
- zelleEmail
- zelleRecipientName
- venmoEmail
- venmoRecipientName
- storeName (신규 추천)
- kakaoChannelDisplayName (선택)

템플릿에는 가공된 computed 변수도 제공한다.

---

## 변수 계층 정의

### A. event 변수
도메인 이벤트에서 직접 옴
- 주문번호
- 상품명
- 수량
- 고객명
- 라이브주제
- 상세내용
- 방송URL

### B. system 변수
운영 설정에서 옴
- 쇼핑몰명
- 은행명
- 계좌번호
- 예금주
- zelleEmail
- zelleRecipientName
- venmoEmail
- venmoRecipientName

### C. computed 변수
백엔드가 조합해서 만듦
- 결제수단명
- 결제계정
- 수취인명
- 상품요약
- 라이브상세요약

---

## 템플릿별 권장 변수

## 1. ORDER_CONFIRMATION (친구톡)
### 유지 변수
- #{고객명}
- #{주문번호}
- #{상품명}
- #{수량}
- #{금액}

### 권장 추가/정리 변수
- #{결제수단명}
- #{결제계정}
- #{수취인명}

### 호환 유지 가능
- #{은행명}
- #{계좌번호}
- #{예금주}

### 권장
장기적으로는 템플릿이 결제수단 추상화 변수 위주로 가는 게 좋다.

---

## 2. PAYMENT_REMINDER (알림톡)
### 현재 변수
- #{주문번호}
- #{금액}

### 권장 확장
- #{고객명}
- #{결제수단명}
- #{결제계정}
- #{수취인명}
- #{주문상세URL}

### 이유
입금 안내 템플릿이 실제 결제 설정값과 연결돼야 운영 변경에 덜 취약하다.

---

## 3. CART_EXPIRING (알림톡)
### 현재 변수 유지
- #{고객명}
- #{상품명}
- #{수량}

### 선택 확장
- #{남은시간분}
- #{장바구니URL}

### 메모
이 템플릿은 현재 구조도 비교적 단순하고 안정적이다.

---

## 4. LIVE_START (알림톡)
### 현재 변수
- #{쇼핑몰명}
- #{라이브주제}
- #{상세내용}
- #{방송URL}

### 현재 문제
- `#{쇼핑몰명}` 이 하드코딩 `'도레미마켓'`
- `#{상세내용}` 은 `streamDescription ?? streamTitle` 수준
- 운영자가 어떤 설명이 들어갈지 세밀하게 제어하기 어려움

### 권장 수정
- `#{쇼핑몰명}` → `system.storeName`
- `#{상세내용}` → 우선순위
  1. `live.notificationDescription` (신규 필드 추천)
  2. `live.description`
  3. `live.title`
- `#{방송URL}` → 현재 유지

### 신규 필드 추천
라이브 스트림 모델 또는 관리자 방송 생성/편집 입력에 아래 추가 검토
- `notificationDescription: string | null`

이렇게 하면 방송 상세 설명과 알림톡용 설명을 분리 가능.

---

## admin UI 권장 변경
현재 UI는
- 변수 목록 표시
- 카카오 템플릿 코드 저장
- 본문 읽기 전용
- 테스트 발송

권장 추가
1. 변수 설명 표시
2. sourceType 표시 (`event/system/computed`)
3. sample 값 표시
4. 알림톡 필수 변수 누락 경고
5. LIVE_START 의 상세내용 source 설명 표시
   - 예: `notificationDescription > description > title`

---

## 백엔드 구현 순서
1. `shared-types/notification-variables.ts` 메타데이터 확장
2. `renderTemplate()` 공통 함수 추가
3. `resolvePreferredPaymentMethod(systemConfig)` 유틸 추가
4. 템플릿별 변수 resolver 추가
5. `alimtalk.service.ts` 의 하드코딩 replace 체인 제거
6. LIVE_START 에 `storeName` 연동
7. `notificationDescription` 필드 추가 여부 결정
8. admin UI 변수 설명/source/sample 표시
9. 테스트 코드 추가
   - 변수 resolver 테스트
   - settings 값 변경 시 메시지 반영 테스트

---

## 빠른 1차 적용안
대수술 전에 바로 효과 큰 것
1. `storeName` 을 SystemConfig 에 추가
2. LIVE_START 에서 하드코딩 제거
3. PAYMENT_REMINDER 변수에
   - #{결제수단명}
   - #{결제계정}
   - #{수취인명}
   추가
4. shared-types 에 변수 메타데이터로 description/sample 추가
5. admin UI 에 변수 설명 표시

---

## 최종 판단
- 현재 구조는 작동은 한다.
- 하지만 변수 정의, 실제 치환, settings 연동이 분산돼 있어 drift 위험이 있다.
- 특히 LIVE_START 와 PAYMENT_REMINDER 는 지금보다 구조화가 필요하다.
- 가장 먼저 손댈 곳은
  1. LIVE_START 하드코딩 제거
  2. PAYMENT_REMINDER 의 결제 settings 연동 강화
  3. 변수 메타데이터 단일화

