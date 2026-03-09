# FeaturedProductBar API 테스트 가이드

## 테스트 환경

- 백엔드: http://localhost:3001
- 프론트엔드: http://localhost:3000

---

## 🔧 사전 준비

### 1. 관리자 로그인 토큰 발급

```bash
# 카카오 로그인 또는 기존 관리자 계정으로 로그인하여 accessToken 획득
# 예: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 테스트용 라이브 스트림 생성

```bash
curl -X POST http://localhost:3001/api/streaming/generate-key \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Featured Product 테스트 라이브"
  }'
```

**응답 예시:**

```json
{
  "id": "stream-uuid",
  "streamKey": "abc123def456...",
  "title": "Featured Product 테스트 라이브",
  "status": "PENDING",
  "rtmpUrl": "rtmp://localhost:1935/live/abc123def456...",
  "hlsUrl": "http://localhost:8080/live/abc123def456.../index.m3u8"
}
```

**streamKey를 복사해두세요!** → 예: `abc123def456...`

### 3. 테스트용 상품 생성

```bash
curl -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "streamKey": "abc123def456...",
    "name": "테스트 블랙 티셔츠",
    "price": 29900,
    "quantity": 50,
    "colorOptions": ["블랙", "화이트"],
    "sizeOptions": ["S", "M", "L"],
    "shippingFee": 3000,
    "timerEnabled": true,
    "timerDuration": 10
  }'
```

**응답 예시:**

```json
{
  "id": "product-uuid",
  "name": "테스트 블랙 티셔츠",
  "price": 29900,
  "stock": 50,
  ...
}
```

**productId를 복사해두세요!** → 예: `product-uuid`

---

## 📝 API 테스트 시나리오

### Test 1: Featured Product 조회 (초기 상태 - null)

**요청:**

```bash
curl -X GET http://localhost:3001/api/streaming/key/abc123def456.../featured-product
```

**예상 응답:**

```json
{
  "product": null
}
```

**✅ 성공 조건:** product가 null

---

### Test 2: Featured Product 설정 (Admin)

**요청:**

```bash
curl -X POST http://localhost:3001/api/streaming/abc123def456.../featured-product \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-uuid"
  }'
```

**예상 응답:**

```json
{
  "success": true,
  "product": {
    "id": "product-uuid",
    "name": "테스트 블랙 티셔츠",
    "price": 29900,
    "imageUrl": null,
    "stock": 50
  }
}
```

**✅ 성공 조건:**

- success: true
- product 정보 반환
- Redis에 저장됨
- WebSocket 이벤트 발송됨 (콘솔 확인)

---

### Test 3: Featured Product 조회 (설정 후)

**요청:**

```bash
curl -X GET http://localhost:3001/api/streaming/key/abc123def456.../featured-product
```

**예상 응답:**

```json
{
  "product": {
    "id": "product-uuid",
    "name": "테스트 블랙 티셔츠",
    "price": 29900,
    "imageUrl": null,
    "stock": 50,
    "colorOptions": ["블랙", "화이트"],
    "sizeOptions": ["S", "M", "L"],
    "status": "AVAILABLE"
  }
}
```

**✅ 성공 조건:** product 정보가 정상적으로 반환됨

---

### Test 4: Featured Product 해제 (Admin)

**요청:**

```bash
curl -X PATCH http://localhost:3001/api/streaming/abc123def456.../featured-product/clear \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**예상 응답:**

```json
{
  "success": true
}
```

**✅ 성공 조건:**

- success: true
- Redis에서 삭제됨
- WebSocket 이벤트 발송됨 (product: null)

---

### Test 5: Featured Product 재조회 (해제 후)

**요청:**

```bash
curl -X GET http://localhost:3001/api/streaming/key/abc123def456.../featured-product
```

**예상 응답:**

```json
{
  "product": null
}
```

**✅ 성공 조건:** product가 null로 돌아감

---

## 🌐 프론트엔드 통합 테스트

### 1. 라이브 페이지 접속

```
http://localhost:3000/live/abc123def456...
```

### 2. Featured Product 설정 (API 호출)

위의 Test 2 실행

### 3. 화면 확인

**예상 결과:**

- 화면 하단에 FeaturedProductBar가 나타남
- 상품 정보 표시 (이름, 가격, 재고)
- "구매하기" 버튼 표시

### 4. Featured Product 해제 (API 호출)

위의 Test 4 실행

### 5. 화면 확인

**예상 결과:**

- FeaturedProductBar가 사라짐

---

## 🔍 디버깅 체크리스트

### 백엔드 로그 확인

```bash
# backend 서버 로그
tail -f D:/Project/doremi/backend/backend-server.log

# 다음 로그가 보여야 함:
# - Featured product set for stream {streamKey}: {productId}
# - Broadcasting featured product update to room stream:{streamKey}
# - Featured product cleared for stream {streamKey}
```

### Redis 데이터 확인

```bash
# Redis CLI 접속
redis-cli

# Featured product 확인
GET stream:abc123def456...:featured-product
# 결과: "product-uuid" (설정된 경우) 또는 (nil) (해제된 경우)
```

### WebSocket 이벤트 확인

**브라우저 콘솔에서 확인:**

```javascript
// 개발자 도구 → Console
// 다음 로그가 보여야 함:
[FeaturedProductBar] WebSocket connected
[FeaturedProductBar] Featured product updated: {product object}
```

---

## ❌ 예상 오류 및 해결

### 1. 401 Unauthorized

**원인:** 잘못된 또는 만료된 토큰
**해결:** 새로 로그인하여 토큰 재발급

### 2. 404 Stream Not Found

**원인:** 존재하지 않는 streamKey
**해결:** streamKey 확인 및 스트림 재생성

### 3. 404 Product Not Found

**원인:** 해당 stream에 속하지 않는 product
**해결:** 올바른 streamKey의 product 사용

### 4. WebSocket 연결 실패

**원인:** CORS 또는 인증 문제
**해결:**

- CORS_ORIGINS 환경변수 확인
- 토큰이 localStorage에 저장되어 있는지 확인

---

## ✅ 성공 기준

**모든 테스트가 통과하면:**

1. ✅ API가 정상 작동
2. ✅ Redis 저장/조회/삭제 동작
3. ✅ WebSocket 실시간 업데이트
4. ✅ 프론트엔드 UI 반영

**→ FeaturedProductBar 기능 구현 완료!**

---

**테스트 실행 날짜:** 2026-02-04
**다음 단계:** Phase 1-2 (상품 필드 확장) 또는 관리자 UI 구현
