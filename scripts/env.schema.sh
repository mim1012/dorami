#!/usr/bin/env bash
# =============================================================================
# Single Source of Truth: Environment Variable Schema
# =============================================================================
# 이 파일이 staging ↔ prod 모든 환경 변수의 유일한 정의 기준입니다.
# validate-env.sh, compare-env.sh, 배포 스크립트가 이 파일을 공통으로 참조합니다.
#
# 형식:
#   define_var <NAME> <envs> <format> <description>
#
#   envs   : all | staging | prod | staging,prod | dev
#   format : nonempty | url | rtmp | hex64 | email_list | bool | int | any | secret
#             secret = nonempty이지만 값 로그 출력 시 마스킹 처리
#
# 사용법: source scripts/env.schema.sh
# =============================================================================

# ─────────────────────────────────────────────
# 스키마 정의 저장소 초기화
# ─────────────────────────────────────────────
ENV_SCHEMA_NAMES=()
ENV_SCHEMA_ENVS=()
ENV_SCHEMA_FORMATS=()
ENV_SCHEMA_DESCS=()

define_var() {
  local name="$1" envs="$2" format="$3" desc="$4"
  ENV_SCHEMA_NAMES+=("$name")
  ENV_SCHEMA_ENVS+=("$envs")
  ENV_SCHEMA_FORMATS+=("$format")
  ENV_SCHEMA_DESCS+=("$desc")
}

# ─────────────────────────────────────────────
# 런타임/앱 환경
# ─────────────────────────────────────────────
define_var APP_ENV          "all"          "nonempty" "앱 환경 (development|staging|production)"
define_var NODE_ENV         "all"          "nonempty" "Node 환경 (development|production)"
define_var PORT             "all"          "int"      "백엔드 HTTP 포트 (기본 3001)"
define_var LOG_LEVEL        "all"          "nonempty" "로그 레벨 (debug|info|warn|error)"

# ─────────────────────────────────────────────
# 데이터베이스
# ─────────────────────────────────────────────
define_var DATABASE_URL     "all"          "url"      "PostgreSQL 연결 URL (connection_limit, pool_timeout 포함)"

# ─────────────────────────────────────────────
# Redis
# ─────────────────────────────────────────────
define_var REDIS_URL        "all"          "url"      "Redis 연결 URL"
define_var REDIS_HOST       "all"          "nonempty" "Redis 호스트"
define_var REDIS_PORT       "all"          "int"      "Redis 포트 (기본 6379)"
define_var REDIS_PASSWORD   "staging,prod" "secret"   "Redis 비밀번호 (staging/prod 필수)"
define_var REDIS_PUBSUB_URL "all"          "url"      "Redis Pub/Sub DB URL"

# ─────────────────────────────────────────────
# JWT
# ─────────────────────────────────────────────
define_var JWT_SECRET              "all"  "secret"   "JWT 서명 비밀키 (최소 32자, prod 64자+)"
define_var JWT_ACCESS_EXPIRES_IN   "all"  "nonempty" "Access 토큰 TTL (예: 15m)"
define_var JWT_REFRESH_EXPIRES_IN  "all"  "nonempty" "Refresh 토큰 TTL (예: 7d)"

# ─────────────────────────────────────────────
# 암호화
# ─────────────────────────────────────────────
define_var PROFILE_ENCRYPTION_KEY  "all"  "hex64"    "AES-256-GCM 키 (64자 hex)"

# ─────────────────────────────────────────────
# 카카오 OAuth
# ─────────────────────────────────────────────
define_var KAKAO_CLIENT_ID      "all"  "secret"   "카카오 REST API 키"
define_var KAKAO_CLIENT_SECRET  "all"  "secret"   "카카오 시크릿 키"
define_var KAKAO_CALLBACK_URL   "all"  "url"      "카카오 콜백 URL"

# ─────────────────────────────────────────────
# 프론트엔드 / CORS
# ─────────────────────────────────────────────
define_var FRONTEND_URL   "all"          "url"        "프론트엔드 Origin URL"
define_var CORS_ORIGINS   "all"          "nonempty"   "CORS 허용 도메인 (콤마 구분)"

# ─────────────────────────────────────────────
# 보안 플래그
# ─────────────────────────────────────────────
define_var CSRF_ENABLED   "all"          "bool"  "CSRF 보호 활성화 여부"
define_var ENABLE_DEV_AUTH "all"         "bool"  "개발 로그인 엔드포인트 활성화 (prod에서 반드시 false)"

# ─────────────────────────────────────────────
# 스트리밍
# ─────────────────────────────────────────────
define_var RTMP_SERVER_URL  "all"  "rtmp"    "RTMP 인제스트 URL (OBS용)"
define_var HLS_SERVER_URL   "all"  "url"     "HLS 재생 URL"
define_var SRS_API_URL      "all"  "url"     "SRS 내부 API URL"

# ─────────────────────────────────────────────
# 관리자
# ─────────────────────────────────────────────
define_var ADMIN_EMAILS  "all"  "email_list"  "관리자 이메일 (콤마 구분, 자동 ADMIN 역할 부여)"

# ─────────────────────────────────────────────
# 타이머
# ─────────────────────────────────────────────
define_var CART_EXPIRATION_MINUTES               "all"  "int"  "장바구니 만료 시간 (분)"
define_var RESERVATION_PROMOTION_TIMER_MINUTES   "all"  "int"  "예약 승격 타이머 (분)"
define_var ORDER_EXPIRATION_MINUTES              "all"  "int"  "주문 만료 시간 (분)"
define_var AUTH_BLACKLIST_TTL_SECONDS            "all"  "int"  "토큰 블랙리스트 TTL (초)"

# ─────────────────────────────────────────────
# 은행 계좌 (무통장 입금)
# ─────────────────────────────────────────────
define_var BANK_NAME            "all"  "nonempty"  "은행명"
define_var BANK_ACCOUNT_NUMBER  "all"  "nonempty"  "계좌번호"
define_var BANK_ACCOUNT_HOLDER  "all"  "nonempty"  "예금주"

# ─────────────────────────────────────────────
# 선택(Optional) 변수 — 없어도 배포 가능
# ─────────────────────────────────────────────
define_var SENTRY_DSN                    "any"  "any"  "(선택) Sentry DSN"
define_var APP_VERSION                   "any"  "any"  "(선택) 앱 버전 태그"
define_var KAKAOTALK_API_KEY             "any"  "any"  "(선택) 알림톡 API 키"
define_var NEXT_PUBLIC_KAKAO_JS_KEY      "any"  "any"  "(선택) 카카오 JS SDK 키 (프론트)"
define_var NEXT_PUBLIC_KAKAO_CHANNEL_ID  "any"  "any"  "(선택) 카카오채널 ID (프론트)"
define_var PROFILE_LEGACY_ENCRYPTION_KEYS "any" "any" "(선택) 레거시 암호화 키 (콤마 구분)"
define_var SOLAPI_API_URL                "any"  "any"  "(선택) Solapi 알림톡 엔드포인트"
