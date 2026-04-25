import { getNotificationPresentation } from '../presentation';

describe('notification presentation copy', () => {
  it('LIVE_START explains only broadcast title and description input flow', () => {
    const presentation = getNotificationPresentation('LIVE_START');

    expect(presentation.sendTiming).toContain('라이브 방송을 시작하는 순간');
    expect(presentation.valueIntro).toContain('제목과 상세내용만 입력하면 됩니다');
    expect(presentation.valueIntro).not.toContain('streamTitle');
    expect(presentation.primaryAction).toEqual({
      label: '방송 관리로 이동',
      path: '/admin/broadcasts',
    });
    expect(presentation.sourceGroups[0]).toEqual({
      heading: '방송 시작할 때 입력하는 항목',
      items: [
        {
          title: '제목',
          description: '방송 시작 화면에서 입력한 제목이 그대로 고객 알림에 들어갑니다.',
        },
        {
          title: '상세내용',
          description: '방송 시작 화면에서 입력한 상세내용이 그대로 고객 알림에 들어갑니다.',
        },
      ],
    });
  });

  it('ORDER_CONFIRMATION explains Zelle/Venmo-first payment copy without forcing bank labels', () => {
    const presentation = getNotificationPresentation('ORDER_CONFIRMATION');

    expect(presentation.sendTiming).toContain(
      '같은 고객 + 같은 streamKey 기준으로 묶어서 1회 발송',
    );
    expect(presentation.valueIntro).toContain('주문 정보와 결제 안내는 자동으로 채워지며');
    expect(presentation.valueIntro).toContain('#{결제수단}');
    expect(presentation.valueIntro).toContain('은행명은 끼어들지 않습니다');
    expect(presentation.sourceGroups).toContainEqual({
      heading: '관리자 설정에서 가져오는 항목',
      items: [
        {
          title: '입금 안내',
          description:
            'Zelle/Venmo만 설정하면 그 값만 자동으로 사용합니다. 은행 계좌는 선택 사항이라 비워두면 메시지에 들어가지 않습니다.',
        },
      ],
    });
  });

  it('CART_EXPIRING explains long-idle cart reminders without internal variable names', () => {
    const presentation = getNotificationPresentation('CART_EXPIRING');

    expect(presentation.sendTiming).toContain('일정 시간 동안 주문하지 않은 고객');
    expect(presentation.valueIntro).toContain('장기 미구매 시간 기준');
    expect(JSON.stringify(presentation)).not.toContain('streamTitle');
    expect(JSON.stringify(presentation)).not.toContain('streamDescription');
  });
});
