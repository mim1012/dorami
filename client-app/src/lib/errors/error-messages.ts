import { ApiError, TimeoutError } from '@/lib/api/client';

/**
 * errorCode → 유저 친화적 한국어 메시지 매핑
 *
 * 백엔드 BusinessException이 errorCode + context를 보내면,
 * 프론트엔드에서 기술 메시지 대신 이 매핑을 사용한다.
 */
const ERROR_MESSAGES: Record<string, string | ((details?: any) => string)> = {
  INSUFFICIENT_STOCK: (details) => {
    const available = details?.context?.available ?? details?.available;
    return available != null
      ? `앗, 이 상품은 ${available}개만 남았어요! 수량을 조정해주세요.`
      : '재고가 부족해요. 수량을 줄여주세요.';
  },
  CART_EXPIRED: '장바구니 시간이 만료됐어요. 다시 담아주세요!',
  ORDER_NOT_FOUND: '주문을 찾을 수 없어요. 주문 내역을 확인해주세요.',
  PRODUCT_NOT_FOUND: '상품을 찾을 수 없어요. 이미 삭제된 상품일 수 있어요.',
  USER_NOT_FOUND: '회원 정보를 찾을 수 없어요.',
  RESERVATION_NOT_FOUND: '예약 정보를 찾을 수 없어요.',
  INVALID_PAYMENT_STATUS: '결제 상태가 올바르지 않아요. 주문 내역을 확인해주세요.',
  SESSION_EXPIRED: '로그인이 만료되었어요. 다시 로그인해주세요.',
  PROFILE_INCOMPLETE: '구매를 위해 프로필 정보가 필요해요.',
  TOO_MANY_REQUESTS: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
  PRODUCT_SOLD_OUT: '이 상품은 품절되었어요.',
  INSUFFICIENT_POINTS: '포인트가 부족해요. 보유 포인트를 확인해주세요.',
};

/** HTTP status → fallback 한국어 메시지 */
const STATUS_FALLBACKS: Record<number, string> = {
  400: '요청을 처리할 수 없어요. 다시 시도해주세요.',
  401: '로그인이 필요해요.',
  403: '접근 권한이 없어요.',
  404: '찾을 수 없어요.',
  429: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
  500: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
};

/**
 * 에러 객체를 유저 친화적 한국어 메시지로 변환한다.
 *
 * 우선순위: errorCode 매핑 → HTTP status fallback → generic fallback
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof TimeoutError) {
    return '인터넷 연결이 느려요. 잠시 후 다시 시도해주세요.';
  }

  if (error instanceof TypeError) {
    return '인터넷 연결을 확인해주세요.';
  }

  if (!(error instanceof ApiError)) {
    return '알 수 없는 오류가 발생했어요. 다시 시도해주세요.';
  }

  const mapped = ERROR_MESSAGES[error.errorCode];
  if (mapped) {
    return typeof mapped === 'function' ? mapped(error.details) : mapped;
  }

  const statusFallback = STATUS_FALLBACKS[error.statusCode];
  if (statusFallback) {
    return statusFallback;
  }

  return '문제가 발생했어요. 다시 시도해주세요.';
}
