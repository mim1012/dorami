import { buildTestMessage, formatDeliveryReason } from '../shared';

describe('formatDeliveryReason', () => {
  it('maps known provider reasons to operator-friendly copy', () => {
    expect(formatDeliveryReason('template_code_missing')).toBe(
      '카카오 템플릿 코드가 설정되지 않았습니다.',
    );
    expect(formatDeliveryReason('template_disabled')).toBe(
      '이 알림은 템플릿 스위치가 꺼져 있어 발송되지 않습니다.',
    );
  });

  it('falls back to raw reason text for unknown cases', () => {
    expect(formatDeliveryReason('mystery_reason')).toBe('사유: mystery_reason');
  });
});

describe('buildTestMessage', () => {
  it('includes summary and first delivery detail', () => {
    expect(
      buildTestMessage({
        totals: { sent: 1, failed: 0, skipped: 0 },
        results: [
          {
            status: 'sent',
            channel: 'AT',
            recipient: '01012345678',
            providerCode: 'A000',
            providerMessage: 'Success',
            providerMessageKey: 'msg-1',
          },
        ],
      }),
    ).toBe('성공 1건 · 실패 0건 · 건너뜀 0건\nAT 발송 성공 · 코드 A000 · Success · msgKey msg-1');
  });

  it('returns only the summary when result details are missing', () => {
    expect(
      buildTestMessage({
        totals: { sent: 0, failed: 0, skipped: 1 },
        results: [],
      }),
    ).toBe('성공 0건 · 실패 0건 · 건너뜀 1건');
  });
});
