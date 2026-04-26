-- Seed: 알림톡 템플릿 2개 (LIVE_START, ORDER_CONFIRMATION)
-- 장바구니 리마인더는 친구톡(FT)으로 발송 — 카카오 심사 불필요, 메시지 코드에 하드코딩됨
-- kakao_template_code는 카카오 비즈니스 채널 승인 후 어드민 UI에서 입력

INSERT INTO "notification_templates" ("id", "name", "type", "template", "kakao_template_code", "created_at", "updated_at")
VALUES
  (
    gen_random_uuid(),
    '라이브 시작 알림',
    'LIVE_START',
    '[#{쇼핑몰명}] 라이브 방송 시작 안내

고객님께서 신청하신 라이브 방송이 시작되었습니다.

■ 방송 주제 : #{라이브주제}
■ 방송 내용 : #{상세내용}

라이브 시청 : #{방송URL}',
    'LIVE_ALAM',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    '인보이스 알림',
    'ORDER_CONFIRMATION',
    '[도레미 마켓] 주문이 접수되었습니다

#{고객명}님, 주문이 완료되었습니다.

■ 주문번호: #{주문번호}
■ 주문상품: #{상품명} 외 #{수량}건
■ 결제금액: #{금액} $

현재 입금대기 상태입니다.
아래 계좌로 입금해주시면 확인 후 처리됩니다.

■ 입금계좌: #{은행명} #{계좌번호} (#{예금주})',
    'ORDER_CONFIRMATION',
    NOW(),
    NOW()
  )
ON CONFLICT ("name") DO NOTHING;
