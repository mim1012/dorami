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
import {
  ADMIN_NOTIFICATION_TEMPLATE_TYPES,
  NOTIFICATION_VARIABLES,
  type AdminNotificationTemplateType,
} from '@live-commerce/shared-types';
import { getNotificationPresentation } from './presentation';

interface NotificationTemplate {
  id: string;
  name: string;
  type: AdminNotificationTemplateType;
  template: string;
  kakaoTemplateCode: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationSettingsConfig {
  orderConfirmationDelayHours: number;
  abandonedCartReminderHours: number;
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

const EVENT_TYPES = [...ADMIN_NOTIFICATION_TEMPLATE_TYPES];

type TestEndpointMap = Record<AdminNotificationTemplateType, string>;

const TEST_ENDPOINTS: TestEndpointMap = {
  ORDER_CONFIRMATION: '/admin/alimtalk/test-order',
  CART_EXPIRING: '/admin/alimtalk/test-cart-expiring',
  LIVE_START: '/admin/alimtalk/test-live',
};

function isManagedNotificationType(type: string): type is AdminNotificationTemplateType {
  return EVENT_TYPES.includes(type as AdminNotificationTemplateType);
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
    case 'template_disabled':
      return '이 알림은 템플릿 스위치가 꺼져 있어 발송되지 않습니다.';
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
  const [settingsConfig, setSettingsConfig] = useState<NotificationSettingsConfig>({
    orderConfirmationDelayHours: 0,
    abandonedCartReminderHours: 24,
  });
  const [activeType, setActiveType] = useState<AdminNotificationTemplateType>('ORDER_CONFIRMATION');
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isSavingOrderDelay, setIsSavingOrderDelay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [testTarget, setTestTarget] = useState<AdminNotificationTemplateType | null>(null);
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
        const [templateResponse, settingsResponse] = await Promise.all([
          apiClient.get<NotificationTemplate[]>('/admin/notification-templates'),
          apiClient.get<NotificationSettingsConfig>('/admin/config/settings'),
        ]);
        const managed = templateResponse.data.filter((template) =>
          isManagedNotificationType(template.type),
        );
        const filtered = getVisibleTemplates(managed);
        setTemplates(filtered);
        setSettingsConfig({
          orderConfirmationDelayHours: settingsResponse.data.orderConfirmationDelayHours ?? 0,
          abandonedCartReminderHours: settingsResponse.data.abandonedCartReminderHours ?? 24,
        });

        if (filtered.length > 0) {
          setActiveType(filtered[0].type);
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

  const handleEnabledChange = (id: string, enabled: boolean) => {
    setTemplates((prev) =>
      prev.map((template) => (template.id === id ? { ...template, enabled } : template)),
    );
  };

  const handleSave = async (template: NotificationTemplate) => {
    setSavingId(template.id);
    setError(null);
    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        kakaoTemplateCode: template.kakaoTemplateCode,
        enabled: template.enabled,
      });
      setSuccessId(template.id);
      setTimeout(() => setSuccessId(null), 2500);
    } catch (err: unknown) {
      setError(getUserMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNotificationTiming = async () => {
    setIsSavingOrderDelay(true);
    setError(null);
    try {
      await apiClient.put('/admin/config/settings', {
        orderConfirmationDelayHours: settingsConfig.orderConfirmationDelayHours,
        abandonedCartReminderHours: settingsConfig.abandonedCartReminderHours,
      });
      setSuccessId('order-confirmation-delay');
      setTimeout(() => setSuccessId(null), 2500);
    } catch (err: unknown) {
      setError(getUserMessage(err));
    } finally {
      setIsSavingOrderDelay(false);
    }
  };

  const openTestModal = (type: AdminNotificationTemplateType) => {
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
      const response = await apiClient.post<TestDeliveryResponse>(endpoint, {
        phone: phone.trim(),
      });
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
          <p className="text-sm text-gray-500">템플릿 목록을 불러오는 중입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/settings')}
          className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-white"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Bell className="h-7 w-7 text-[#FF4D8D]" />
            카카오 알림 설정
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            알림톡/친구톡 본문은 심사본 기준으로 읽기 전용이며, 이 화면에서는 템플릿 코드와 이벤트별
            ON/OFF만 관리합니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-16 text-center shadow-sm">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-600">
            등록된 알림 템플릿이 없습니다. 운영 반영 상태를 확인해 주세요.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {visibleTemplates.map((template) => {
                const config = NOTIFICATION_VARIABLES[template.type];
                const isActive = activeType === template.type;
                return (
                  <button
                    key={template.id}
                    onClick={() => setActiveType(template.type)}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      isActive
                        ? 'border-[#FF4D8D] bg-pink-50 text-[#C62F74] shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:bg-pink-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-5">{config.label}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {template.enabled ? '발송 가능' : '발송 중지'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          config.channel === 'AT'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        {config.channel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTemplate && (
            <div className="p-6">
              {(() => {
                const presentation = getNotificationPresentation(activeTemplate.type);

                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          {NOTIFICATION_VARIABLES[activeTemplate.type].label}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">{presentation.sendTiming}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <label className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
                          <span
                            className={`text-xs font-semibold ${
                              activeTemplate.enabled ? 'text-emerald-600' : 'text-gray-500'
                            }`}
                          >
                            {activeTemplate.enabled ? '발송 ON' : '발송 OFF'}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={activeTemplate.enabled}
                            onClick={() =>
                              handleEnabledChange(activeTemplate.id, !activeTemplate.enabled)
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              activeTemplate.enabled ? 'bg-[#FF4D8D]' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                activeTemplate.enabled ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </label>
                        {successId === activeTemplate.id && (
                          <span className="flex items-center gap-1.5 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
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
                          onClick={() => openTestModal(activeTemplate.type)}
                        >
                          테스트 발송
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="rounded-xl border border-pink-100 bg-pink-50/70 p-4">
                        <p className="text-sm font-semibold text-pink-700">값 입력 방식</p>
                        <p className="mt-1 text-sm text-pink-700/90">{presentation.valueIntro}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {presentation.primaryAction && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(presentation.primaryAction!.path)}
                            >
                              {presentation.primaryAction.label}
                            </Button>
                          )}
                          {presentation.secondaryAction && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(presentation.secondaryAction!.path)}
                            >
                              {presentation.secondaryAction.label}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {presentation.sourceGroups.map((group) => (
                          <div
                            key={group.heading}
                            className="rounded-xl border border-gray-200 bg-gray-50/70 p-4"
                          >
                            <p className="text-sm font-semibold text-gray-900">{group.heading}</p>
                            <div className="mt-3 space-y-3">
                              {group.items.map((item) => (
                                <div key={item.title}>
                                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                                  <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {activeTemplate.type === 'ORDER_CONFIRMATION' && (
                        <div className="rounded-xl border border-pink-100 bg-pink-50/70 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                방송 종료 후 N시간 뒤 발송
                              </p>
                              <p className="mt-1 text-sm text-gray-600">
                                라이브 방송 주문은 같은 고객 + 같은 streamKey 기준으로 한 번만
                                묶어서 보냅니다.
                              </p>
                            </div>
                            {successId === 'order-confirmation-delay' && (
                              <span className="flex items-center gap-1.5 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                저장 완료
                              </span>
                            )}
                          </div>
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="w-full sm:max-w-xs">
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                지연 시간 (0~168)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={168}
                                step={1}
                                value={settingsConfig.orderConfirmationDelayHours}
                                onChange={(event) =>
                                  setSettingsConfig({
                                    ...settingsConfig,
                                    orderConfirmationDelayHours: Math.min(
                                      168,
                                      Math.max(0, parseInt(event.target.value || '0', 10) || 0),
                                    ),
                                  })
                                }
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm transition-colors focus:border-[#FF4D8D] focus:outline-none focus:ring-2 focus:ring-pink-100"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSaveNotificationTiming}
                              disabled={isSavingOrderDelay}
                            >
                              {isSavingOrderDelay ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-1.5" />
                              )}
                              {isSavingOrderDelay ? '저장 중...' : '지연 저장'}
                            </Button>
                          </div>
                          <p className="mt-3 text-xs text-gray-500">
                            0이면 방송 종료 직후 스케줄러가 바로 처리할 수 있습니다. 비라이브 주문은
                            계속 즉시 발송됩니다.
                          </p>
                        </div>
                      )}

                      {activeTemplate.type === 'CART_EXPIRING' && (
                        <div className="rounded-xl border border-pink-100 bg-pink-50/70 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                방송 종료 후 N시간 뒤 발송
                              </p>
                              <p className="mt-1 text-sm text-gray-600">
                                같은 고객 + 같은 streamKey 기준의 활성 장바구니 상품만 묶어서 한
                                번만 보냅니다.
                              </p>
                            </div>
                            {successId === 'order-confirmation-delay' && (
                              <span className="flex items-center gap-1.5 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                저장 완료
                              </span>
                            )}
                          </div>
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="w-full sm:max-w-xs">
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                지연 시간 (0~168)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={168}
                                step={1}
                                value={settingsConfig.abandonedCartReminderHours}
                                onChange={(event) =>
                                  setSettingsConfig({
                                    ...settingsConfig,
                                    abandonedCartReminderHours: Math.min(
                                      168,
                                      Math.max(0, parseInt(event.target.value || '0', 10) || 0),
                                    ),
                                  })
                                }
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm transition-colors focus:border-[#FF4D8D] focus:outline-none focus:ring-2 focus:ring-pink-100"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSaveNotificationTiming}
                              disabled={isSavingOrderDelay}
                            >
                              {isSavingOrderDelay ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-1.5" />
                              )}
                              {isSavingOrderDelay ? '저장 중...' : '지연 저장'}
                            </Button>
                          </div>
                          <p className="mt-3 text-xs text-gray-500">
                            0이면 방송 종료 직후 바로 처리됩니다. 메시지에는 같은 방송 장바구니
                            상품이 {'#{상품명}'} 외 {'#{수량}'}건 형태로 표시됩니다.
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          카카오템플릿 코드
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={activeTemplate.kakaoTemplateCode ?? ''}
                            onChange={(event) =>
                              handleTemplateCodeChange(activeTemplate.id, event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm transition-colors focus:border-[#FF4D8D] focus:outline-none focus:ring-2 focus:ring-pink-100"
                            placeholder="예: KA01TP..."
                          />
                          {NOTIFICATION_VARIABLES[activeTemplate.type].channel === 'AT' &&
                            !activeTemplate.kakaoTemplateCode?.trim() && (
                              <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                미설정
                              </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          카카오 심사 완료된 템플릿 코드를 입력하면 됩니다.
                        </p>
                      </div>

                      <div>
                        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          본문은 운영 심사본 기준으로 읽기 전용이며 수정할 수 없습니다.
                        </div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          템플릿 본문
                        </label>
                        <textarea
                          value={activeTemplate.template}
                          readOnly
                          rows={8}
                          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-mono text-gray-800 transition-colors focus:outline-none"
                          placeholder="알림톡 본문을 불러올 수 없습니다."
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
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
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">테스트 발송</h3>
              <button onClick={closeTestModal} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              {NOTIFICATION_VARIABLES[testTarget].label} 템플릿으로 테스트 발송합니다.
            </p>

            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              수신자 전화번호
            </label>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900"
              placeholder="01012345678"
            />

            {testMessage && (
              <p
                className={`mb-3 text-sm ${
                  testMessageTone === 'success' ? 'text-green-600' : 'text-red-600'
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
