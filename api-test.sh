#!/bin/bash

# Direct API Testing for Ralph Mode Verification

echo "=== Ralph Mode — Direct API Testing ==="
echo

BASE_URL="http://localhost:3001"
ADMIN_EMAIL="admin@dorami.shop"

# 1. Admin Login
echo "[1] Admin 로그인..."
CSRF_RESPONSE=$(curl -s -c cookies.txt -b cookies.txt \
  -X POST "$BASE_URL/api/auth/dev-login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\", \"role\":\"ADMIN\"}")

echo "$CSRF_RESPONSE" | head -c 200
echo

# 2. Get CSRF Token
echo "[2] CSRF 토큰 추출..."
CSRF_TOKEN=$(curl -s -b cookies.txt "$BASE_URL/api/auth/me" -i | grep "csrf-token=" | sed 's/.*csrf-token=\([^;]*\).*/\1/')
echo "CSRF Token: ${CSRF_TOKEN:0:20}..."

# 3. Check if health endpoint works
echo
echo "[3] Backend Health Check..."
curl -s "$BASE_URL/api/health" | head -c 300
echo

# 4. Create Test Stream
echo
echo "[4] 테스트 스트림 생성..."
STREAM=$(curl -s -b cookies.txt \
  -X POST "$BASE_URL/api/streaming/start" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "{\"expiresAt\": \"$(date -d '+1 day' -u +%Y-%m-%dT%H:%M:%SZ)\"}")

echo "$STREAM" | head -c 400
STREAM_KEY=$(echo "$STREAM" | grep -o '"streamKey":"[^"]*' | cut -d'"' -f4)
echo
echo "Stream Key: $STREAM_KEY"

# 5. Create Product with Timer
echo
echo "[5] 타이머 설정이 있는 상품 생성..."
PRODUCT=$(curl -s -b cookies.txt \
  -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "{
    \"streamKey\": \"$STREAM_KEY\",
    \"name\": \"Ralph Test Product\",
    \"price\": 29000,
    \"stock\": 50,
    \"timerEnabled\": true,
    \"timerDuration\": 10,
    \"colorOptions\": [\"Red\", \"Blue\"],
    \"sizeOptions\": [\"S\", \"M\", \"L\"]
  }")

echo "$PRODUCT"
PRODUCT_ID=$(echo "$PRODUCT" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
echo
echo "✅ Product Created: $PRODUCT_ID"

# 6. Verify Timer Fields
echo
echo "[6] 타이머 필드 검증..."
if echo "$PRODUCT" | grep -q '"timerEnabled":true'; then
  echo "✅ timerEnabled: true"
else
  echo "❌ timerEnabled: 필드 없음 또는 false"
fi

if echo "$PRODUCT" | grep -q '"timerDuration":10'; then
  echo "✅ timerDuration: 10"
else
  echo "❌ timerDuration: 필드 없음"
fi

# 7. Switch to User and Add to Cart
echo
echo "[7] 사용자 로그인..."
USER_LOGIN=$(curl -s -c user_cookies.txt -b user_cookies.txt \
  -X POST "$BASE_URL/api/auth/dev-login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\", \"role\":\"USER\"}")

USER_CSRF=$(curl -s -b user_cookies.txt "$BASE_URL/api/auth/me" -i | grep "csrf-token=" | sed 's/.*csrf-token=\([^;]*\).*/\1/')

# 8. Add to Cart
echo
echo "[8] 장바구니에 상품 추가..."
CART=$(curl -s -b user_cookies.txt \
  -X POST "$BASE_URL/api/cart" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $USER_CSRF" \
  -d "{\"productId\": \"$PRODUCT_ID\", \"quantity\": 1}")

echo "$CART"

# 9. Check Cart Response
echo
echo "[9] 장바구니 응답 검증..."
if echo "$CART" | grep -q '"timerEnabled":true'; then
  echo "✅ timerEnabled 포함"
else
  echo "❌ timerEnabled 누락"
fi

if echo "$CART" | grep -q '"expiresAt"'; then
  echo "✅ expiresAt 포함"
  EXPIRES_AT=$(echo "$CART" | grep -o '"expiresAt":"[^"]*' | cut -d'"' -f4)
  echo "   만료 시간: $EXPIRES_AT"
else
  echo "❌ expiresAt 누락"
fi

if echo "$CART" | grep -q '"remainingSeconds"'; then
  echo "✅ remainingSeconds 포함"
  REMAINING=$(echo "$CART" | grep -o '"remainingSeconds":[0-9]*' | cut -d':' -f2)
  echo "   남은 시간: $REMAINING초"
else
  echo "❌ remainingSeconds 누락"
fi

# 10. Get Cart
echo
echo "[10] 장바구니 조회..."
GET_CART=$(curl -s -b user_cookies.txt \
  -X GET "$BASE_URL/api/cart" \
  -H "X-CSRF-Token: $USER_CSRF")

echo "$GET_CART" | head -c 500

echo
echo
echo "=== 테스트 완료 ==="

