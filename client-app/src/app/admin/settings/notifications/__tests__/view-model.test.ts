import { getNotificationEditorSummary, getNotificationStatusText } from '../view-model';

describe('getNotificationEditorSummary', () => {
  it('returns a compact live-start summary tied to broadcasts management', () => {
    const summary = getNotificationEditorSummary('LIVE_START');

    expect(summary.manageHere).toBe('여기서는 템플릿 코드 저장과 테스트 발송만 합니다.');
    expect(summary.statusHint).toBe('켜고 끄기는 설정 화면에서 바로 관리합니다.');
    expect(summary.valueSources).toEqual([
      '제목/상세내용은 방송 관리에서 입력합니다.',
      '쇼핑몰명과 방송 링크는 자동으로 들어갑니다.',
    ]);
    expect(summary.actions).toEqual([{ label: '방송 관리', path: '/admin/broadcasts' }]);
  });

  it('returns order confirmation summary with order and payment destinations', () => {
    const summary = getNotificationEditorSummary('ORDER_CONFIRMATION');

    expect(summary.manageHere).toBe('여기서는 템플릿 코드 저장과 테스트 발송만 합니다.');
    expect(summary.valueSources).toEqual([
      '주문번호/상품/금액은 실제 주문 데이터에서 자동으로 가져옵니다.',
      '결제 안내는 설정에 저장된 Zelle·Venmo·은행 정보에서 가져옵니다.',
    ]);
    expect(summary.actions).toEqual([
      { label: '주문 관리', path: '/admin/orders' },
      { label: '결제 설정', path: '/admin/settings' },
    ]);
  });
});

describe('getNotificationStatusText', () => {
  it('returns 꺼짐 when the per-template switch is off', () => {
    expect(getNotificationStatusText(true, false)).toBe('꺼짐');
    expect(getNotificationStatusText(false, false)).toBe('꺼짐');
  });

  it('returns 전체 OFF when only the master switch is off', () => {
    expect(getNotificationStatusText(false, true)).toBe('전체 OFF');
  });

  it('returns 켜짐 when both switches are on', () => {
    expect(getNotificationStatusText(true, true)).toBe('켜짐');
  });
});
