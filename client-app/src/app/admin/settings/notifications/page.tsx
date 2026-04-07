'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { getUserMessage } from '@/lib/errors/error-messages';
import {
  Save,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Bell,
  Loader2,
  MessageSquare,
  X,
} from 'lucide-react';
import { NOTIFICATION_VARIABLES, type NotificationEventType } from '@live-commerce/shared-types';

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  template: string;
  kakaoTemplateCode: string;
  createdAt: string;
  updatedAt: string;
}

type KakaoDeliveryStatus = 'sent' | 'failed' | 'skipped';
type KakaoMessageChannel = 'AT' | 'FT';

interface KakaoDeliveryResult {
  status: KakaoDeliveryStatus;
  channel: KakaoMessageChannel;
  recipient: string;
  providerCode?: string;
  providerMessage?: string;
  providerMessageKey?: string;
  reason?: string;
}

interface KakaoDeliveryBatchResult {
  results: KakaoDeliveryResult[];
  totals: {
    sent: number;
    failed: number;
    skipped: number;
  };
}

interface TestDeliveryResponse {
  phone: string;
  result: KakaoDeliveryBatchResult;
}

const EVENT_TYPES = Object.keys(NOTIFICATION_VARIABLES) as NotificationEventType[];

type TestEndpointMap = Record<NotificationEventType, string>;

const TEST_ENDPOINTS: TestEndpointMap = {
  ORDER_CONFIRMATION: '/admin/alimtalk/test-order-friendtalk',
  PAYMENT_REMINDER: '/admin/alimtalk/test-payment-reminder',
  CART_EXPIRING: '/admin/alimtalk/test-cart-expiring',
  LIVE_START: '/admin/alimtalk/test-live',
};

function isManagedNotificationType(type: string): type is NotificationEventType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_VARIABLES, type);
}

function getVisibleTemplates(templates: NotificationTemplate[]): NotificationTemplate[] {
  return EVENT_TYPES.map((type) => templates.find((template) => template.type === type)).filter(
    Boolean,
  ) as NotificationTemplate[];
}

function formatDeliveryStatus(status: KakaoDeliveryStatus) {
  switch (status) {
    case 'sent':
      return '발송 성공';
    case 'failed':
      return '발송 실패';
    case 'skipped':
      return '발송 건너뜀';
  }
}

function formatDeliveryReason(reason?: string) {
  switch (reason) {
    case 'disabled':
      return '알림톡 기능이 비활성화되어 있습니다.';
    case 'provider_unavailable':
      return 'Bizgo 연동이 준비되지 않았습니다.';
    case 'template_missing':
      return '템플릿 본문이 설정되지 않았습니다.';
    case 'template_code_missing':
      return '카카오 템플릿 코드가 설정되지 않았습니다.';
    case 'provider_rejected':
      return '카카오 발송이 공급자 정책에 의해 거부되었습니다.';
    case 'provider_error':
      return 'Bizgo 요청 처리 중 오류가 발생했습니다.';
    default:
      return reason ? `사유: ${reason}` : null;
  }
}

function buildTestMessage(result: KakaoDeliveryBatchResult) {
  const summary = `성공 ${result.totals.sent}건 · 실패 ${result.totals.failed}건 · 건너뜀 ${result.totals.skipped}건`;
  const detail = result.results[0];

  if (!detail) {
    return summary;
  }

  const parts = [
    `${detail.channel} ${formatDeliveryStatus(detail.status)}`,
    detail.providerCode ? `코드 ${detail.providerCode}` : null,
    detail.providerMessage ? detail.providerMessage : null,
    detail.providerMessageKey ? `msgKey ${detail.providerMessageKey}` : null,
    formatDeliveryReason(detail.reason),
  ].filter(Boolean);

  return `${summary}\n${parts.join(' · ')}`;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [activeType, setActiveType] = useState<NotificationEventType>('ORDER_CONFIRMATION');
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [testTarget, setTestTarget] = useState<NotificationEventType | null>(null);
  const [phone, setPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testMessageTone, setTestMessageTone] = useState<'success' | 'error'>('success');

  const visibleTemplates = useMemo(() => getVisibleTemplates(templates), [templates]);
  const activeTemplate = useMemo(
    () => visibleTemplates.find((template) => template.type === activeType) ?? visibleTemplates[0],
    [activeType, visibleTemplates],
  );

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<NotificationTemplate[]>(
          '/admin/notification-templates',
        );
        const managed = response.data.filter((template) =>
          isManagedNotificationType(template.type),
        );
        const filtered = getVisibleTemplates(managed);
        setTemplates(filtered);

        if (filtered.length > 0) {
          setActiveType(filtered[0].type as NotificationEventType);
        }
      } catch (err: unknown) {
        setError(getUserMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleTemplateCodeChange = (id: string, value: string) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === id ? { ...template, kakaoTemplateCode: value } : template,
      ),
    );
  };

  const handleSave = async (template: NotificationTemplate) => {
    setSavingId(template.id);
    setError(null);
    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        kakaoTemplateCode: template.kakaoTemplateCode,
      });
      setSuccessId(template.id);
      setTimeout(() => setSuccessId(null), 2500);
    } catch (err: unknown) {
      setError(getUserMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const openTestModal = (type: NotificationEventType) => {
    setTestTarget(type);
    setPhone('');
    setIsTestModalOpen(true);
    setTestMessage(null);
    setTestMessageTone('success');
  };

  const closeTestModal = () => {
    setIsTestModalOpen(false);
    setTestTarget(null);
    setPhone('');
    setTestMessage(null);
    setTestMessageTone('success');
  };

  const handleSendTest = async () => {
    if (!testTarget) {
      return;
    }

    const endpoint = TEST_ENDPOINTS[testTarget];

    setIsSendingTest(true);
    setTestMessage(null);
    try {
      const response = await apiClient.post<TestDeliveryResponse>(endpoint, { phone: phone.trim() });
      setTestMessage(buildTestMessage(response.data.result));
      setTestMessageTone(response.data.result.totals.failed > 0 ? 'error' : 'success');
      if (response.data.result.totals.failed === 0) {
        setTimeout(closeTestModal, 1800);
      }
    } catch (err: unknown) {
      setTestMessage(getUserMessage(err));
      setTestMessageTone('error');
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#FF4D8D] animate-spin" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            템플릿 목록을 불러오는 중입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/settings')}
          className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Bell className="w-7 h-7 text-[#FF4D8D]" />
            알림톡 템플릿 관리
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            알림 문구는 본문 편집이 비활성화되어 읽기 전용으로 운영됩니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-300 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-16 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 dark:text-zinc-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-400">
            등록된 알림 템플릿이 없습니다. 운영 반영 상태를 확인해 주세요.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-zinc-800 overflow-x-auto">
            <div className="flex">
              {visibleTemplates.map((template) => {
                const config = NOTIFICATION_VARIABLES[template.type as NotificationEventType];
                return (
                  <button
                    key={template.id}
                    onClick={() => setActiveType(template.type as NotificationEventType)}
                    className={`px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                      activeType === template.type
                        ? 'border-[#FF4D8D] text-[#FF4D8D] bg-pink-50/50 dark:bg-pink-950/20'
                        : 'border-transparent text-gray-500 dark:text-zinc-300 hover:text-gray-700 dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {template.name}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          config.channel === 'AT'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200'
                            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200'
                        }`}
                      >
                        {config.channel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTemplate && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                    {activeTemplate.name}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                    {activeTemplate.type}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {successId === activeTemplate.id && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-300">
                      <CheckCircle className="w-4 h-4" />
                      저장 완료
                    </span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSave(activeTemplate)}
                    disabled={savingId === activeTemplate.id}
                  >
                    {savingId === activeTemplate.id ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1.5" />
                    )}
                    {savingId === activeTemplate.id ? '저장 중...' : '저장'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTestModal(activeTemplate.type as NotificationEventType)}
                  >
                    테스트 발송
                  </Button>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1.5">
                    카카오템플릿 코드
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={activeTemplate.kakaoTemplateCode ?? ''}
                      onChange={(event) =>
                        handleTemplateCodeChange(activeTemplate.id, event.target.value)
                      }
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-700/30 focus:border-[#FF4D8D] transition-colors"
                      placeholder="예: KA01TP..."
                    />
                    {NOTIFICATION_VARIABLES[activeTemplate.type as NotificationEventType]
                      .channel === 'AT' &&
                      !activeTemplate.kakaoTemplateCode?.trim() && (
                        <span className="shrink-0 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">
                          미설정
                        </span>
                      )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                    알림톡 전송 채널 코드입니다.
                  </p>
                </div>

                <div>
                  <div className="mb-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                    본문은 운영 심사본 기준으로 읽기 전용이며 수정할 수 없습니다.
                  </div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1.5">
                    템플릿 본문
                  </label>
                  <textarea
                    value={activeTemplate.template}
                    readOnly
                    rows={8}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-mono focus:outline-none resize-none transition-colors"
                    placeholder="알림톡 본문을 불러올 수 없습니다."
                  />
                </div>

                <div className="bg-blue-50 dark:bg-zinc-800 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-200 mb-2">
                    사용 가능한 변수
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {NOTIFICATION_VARIABLES[
                      activeTemplate.type as NotificationEventType
                    ].variables.map((variable) => (
                      <code
                        key={variable}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-zinc-700 text-blue-700 dark:text-blue-200 rounded text-xs font-mono"
                      >
                        {variable}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pb-8">
        <Button variant="outline" onClick={() => router.push('/admin/settings')}>
          <ChevronLeft className="w-4 h-4 mr-1.5" />
          이전으로 돌아가기
        </Button>
      </div>

      {isTestModalOpen && testTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                테스트 발송
              </h3>
              <button
                onClick={closeTestModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-zinc-300" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-zinc-300 mb-4">
              {NOTIFICATION_VARIABLES[testTarget].label} 템플릿으로 테스트 발송합니다.
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1.5">
              수신자 전화번호
            </label>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full px-4 py-2.5 mb-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm"
              placeholder="01012345678"
            />

            {testMessage && (
              <p
                className={`text-sm mb-3 ${
                  testMessageTone === 'success'
                    ? 'text-green-600 dark:text-green-300'
                    : 'text-red-600 dark:text-red-300'
                }`}
              >
                {testMessage}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeTestModal}>
                닫기
              </Button>
              <Button
                variant="primary"
                onClick={handleSendTest}
                disabled={isSendingTest || phone.trim().length === 0}
              >
                {isSendingTest ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                )}
                보내기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
