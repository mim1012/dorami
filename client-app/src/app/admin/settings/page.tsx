'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import {
  Save,
  Settings as SettingsIcon,
  DollarSign,
  Bell,
  Loader2,
  Package,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  X,
} from 'lucide-react';
import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';
import { NoticeListManagement } from '@/components/admin/settings/NoticeListManagement';
import { PointsConfiguration } from '@/components/admin/settings/PointsConfiguration';
import { getUserMessage } from '@/lib/errors/error-messages';
import { NOTIFICATION_VARIABLES, type NotificationEventType } from '@live-commerce/shared-types';
import { getNotificationStatusText } from './notifications/view-model';
import {
  TEST_ENDPOINTS,
  buildTestMessage,
  getVisibleTemplates,
  isManagedNotificationType,
  type TestDeliveryResponse,
} from './notifications/shared';

export const dynamic = 'force-dynamic';

interface SystemSettings {
  defaultCartTimerMinutes: number;
  abandonedCartReminderHours: number;
  defaultShippingFee: number;
  caShippingFee: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  zelleEmail: string;
  zelleRecipientName: string;
  venmoEmail: string;
  venmoRecipientName: string;
  alimtalkEnabled: boolean;
  orderConfirmationDelayHours: number;
  businessRegistrationNumber: string;
  businessAddress: string;
  onlineSalesRegistrationNumber: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationEventType;
  template: string;
  kakaoTemplateCode: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const MIN_CART_TIMER_HOURS = 1;
const MAX_CART_TIMER_HOURS = 120;
const MINUTES_PER_HOUR = 60;

type SectionKey =
  | 'payment'
  | 'commerce'
  | 'notification'
  | 'points'
  | 'noticeManagement'
  | 'noticeList'
  | 'footer';

const DEFAULT_SECTION_STATE: Record<SectionKey, boolean> = {
  payment: true,
  commerce: true,
  notification: true,
  points: false,
  noticeManagement: false,
  noticeList: false,
  footer: false,
};

const SECTION_NAV: { key: SectionKey; label: string; icon: typeof DollarSign }[] = [
  { key: 'payment', label: '입금', icon: DollarSign },
  { key: 'commerce', label: '장바구니/배송', icon: ShoppingCart },
  { key: 'notification', label: '알림', icon: Bell },
  { key: 'points', label: '포인트', icon: Package },
  { key: 'noticeManagement', label: '공지관리', icon: SettingsIcon },
  { key: 'noticeList', label: '공지목록', icon: SettingsIcon },
  { key: 'footer', label: '푸터 설정', icon: SettingsIcon },
];

function SectionCard({
  icon: Icon,
  title,
  sectionId,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  sectionId: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={sectionId} className="bg-white rounded-xl border border-gray-100">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 pt-6 pb-4 flex items-center justify-between gap-3"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-50 rounded-lg">
            <Icon className="w-5 h-5 text-[#FF4D8D]" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 text-left">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen ? (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="pt-4 space-y-4">{children}</div>
        </div>
      ) : null}
    </section>
  );
}

function QuickNav({
  currentSection,
  onNavigate,
}: {
  currentSection: SectionKey;
  onNavigate: (section: SectionKey) => void;
}) {
  return (
    <div className="sticky top-2 z-20 -mx-2 px-2 py-2">
      <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {SECTION_NAV.map(({ key, label, icon: Icon }) => {
              const active = currentSection === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    active
                      ? 'bg-pink-50 border-pink-300 text-[#FF4D8D] font-semibold'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-pink-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    defaultCartTimerMinutes: 60,
    abandonedCartReminderHours: 24,
    defaultShippingFee: 10,
    caShippingFee: 8,
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    zelleEmail: '',
    zelleRecipientName: '',
    venmoEmail: '',
    venmoRecipientName: '',
    alimtalkEnabled: false,
    orderConfirmationDelayHours: 0,
    businessRegistrationNumber: '',
    businessAddress: '',
    onlineSalesRegistrationNumber: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] =
    useState<Record<SectionKey, boolean>>(DEFAULT_SECTION_STATE);
  const [activeSection, setActiveSection] = useState<SectionKey>('payment');
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [notificationSavingId, setNotificationSavingId] = useState<string | null>(null);
  const [notificationFeedback, setNotificationFeedback] = useState<string | null>(null);
  const [activeNotificationType, setActiveNotificationType] =
    useState<NotificationEventType>('ORDER_CONFIRMATION');
  const [isSendingNotificationTest, setIsSendingNotificationTest] = useState(false);
  const [notificationTestPhone, setNotificationTestPhone] = useState('');
  const [notificationTestTarget, setNotificationTestTarget] =
    useState<NotificationEventType | null>(null);
  const [notificationTestMessage, setNotificationTestMessage] = useState<string | null>(null);
  const [notificationTestTone, setNotificationTestTone] = useState<'success' | 'error'>('success');

  const visibleNotificationTemplates = getVisibleTemplates(notificationTemplates);
  const activeNotificationTemplate =
    visibleNotificationTemplates.find((template) => template.type === activeNotificationType) ??
    visibleNotificationTemplates[0] ??
    null;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const [settingsResponse, templatesResponse] = await Promise.all([
          apiClient.get<SystemSettings>('/admin/config/settings'),
          apiClient.get<NotificationTemplate[]>('/admin/notification-templates'),
        ]);

        setSettings({
          ...settingsResponse.data,
          bankName: settingsResponse.data.bankName ?? '',
          bankAccountNumber: settingsResponse.data.bankAccountNumber ?? '',
          bankAccountHolder: settingsResponse.data.bankAccountHolder ?? '',
          zelleEmail: settingsResponse.data.zelleEmail ?? '',
          zelleRecipientName: settingsResponse.data.zelleRecipientName ?? '',
          venmoEmail: settingsResponse.data.venmoEmail ?? '',
          venmoRecipientName: settingsResponse.data.venmoRecipientName ?? '',
        });
        const filteredTemplates = getVisibleTemplates(
          templatesResponse.data.filter((template) => isManagedNotificationType(template.type)),
        );
        setNotificationTemplates(filteredTemplates);
        if (filteredTemplates.length > 0) {
          setActiveNotificationType(filteredTemplates[0].type);
        }
      } catch (err: unknown) {
        console.error('Failed to load settings:', err);
        setError(getUserMessage(err));
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      const { data } = await apiClient.put<SystemSettings>('/admin/config/settings', settings);
      setSettings(data);
      setSuccessMessage('설정이 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.response?.data?.message || '설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationToggle = async (template: NotificationTemplate, enabled: boolean) => {
    const previousTemplates = notificationTemplates;
    setNotificationFeedback(null);
    setNotificationSavingId(template.id);
    setNotificationTemplates((prev) =>
      prev.map((item) => (item.id === template.id ? { ...item, enabled } : item)),
    );

    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        enabled,
        kakaoTemplateCode: template.kakaoTemplateCode,
      });
      const config = NOTIFICATION_VARIABLES[template.type];
      setNotificationFeedback(
        `${config.label}을 ${enabled ? '켜짐' : '꺼짐'} 상태로 저장했습니다.`,
      );
    } catch (err: unknown) {
      setNotificationTemplates(previousTemplates);
      setError(getUserMessage(err));
    } finally {
      setNotificationSavingId(null);
    }
  };

  const handleNotificationTemplateCodeChange = (templateId: string, value: string) => {
    setNotificationTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, kakaoTemplateCode: value } : template,
      ),
    );
  };

  const handleNotificationTemplateSave = async (template: NotificationTemplate) => {
    setNotificationSavingId(template.id);
    setNotificationFeedback(null);
    setError(null);

    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        kakaoTemplateCode: template.kakaoTemplateCode,
        enabled: template.enabled,
      });
      setNotificationFeedback(`${NOTIFICATION_VARIABLES[template.type].label} 템플릿 코드를 저장했습니다.`);
    } catch (err: unknown) {
      setError(getUserMessage(err));
    } finally {
      setNotificationSavingId(null);
    }
  };

  const openNotificationTestModal = (type: NotificationEventType) => {
    setNotificationTestTarget(type);
    setNotificationTestPhone('');
    setNotificationTestMessage(null);
    setNotificationTestTone('success');
  };

  const closeNotificationTestModal = () => {
    setNotificationTestTarget(null);
    setNotificationTestPhone('');
    setNotificationTestMessage(null);
    setNotificationTestTone('success');
  };

  const handleSendNotificationTest = async () => {
    if (!notificationTestTarget) {
      return;
    }

    setIsSendingNotificationTest(true);
    setNotificationTestMessage(null);

    try {
      const response = await apiClient.post<TestDeliveryResponse>(TEST_ENDPOINTS[notificationTestTarget], {
        phone: notificationTestPhone.trim(),
      });
      setNotificationTestMessage(buildTestMessage(response.data.result));
      setNotificationTestTone(response.data.result.totals.failed > 0 ? 'error' : 'success');
      if (response.data.result.totals.failed === 0) {
        setTimeout(closeNotificationTestModal, 1800);
      }
    } catch (err: unknown) {
      setNotificationTestMessage(getUserMessage(err));
      setNotificationTestTone('error');
    } finally {
      setIsSendingNotificationTest(false);
    }
  };

  const handleToggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setActiveSection(key);
  };

  const handleNavigateSection = (key: SectionKey) => {
    setActiveSection(key);
    const sectionElement = document.getElementById(key);
    if (sectionElement) {
      sectionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#FF4D8D] animate-spin" />
          <p className="text-sm text-gray-500">설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-[#FF4D8D]" />
            시스템 설정
          </h1>
          <p className="text-sm text-gray-500 mt-1">플랫폼 전체 설정을 관리합니다</p>
        </div>
        <QuickNav currentSection={activeSection} onNavigate={handleNavigateSection} />
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-700">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Payment Settings */}
      <SectionCard
        icon={DollarSign}
        title="입금 정보 (Zelle / Venmo)"
        sectionId="payment"
        isOpen={expandedSections.payment}
        onToggle={() => handleToggleSection('payment')}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">Zelle</h4>
            <Input
              label="Zelle 이메일"
              type="email"
              value={settings.zelleEmail}
              onChange={(e) => setSettings({ ...settings, zelleEmail: e.target.value })}
              placeholder="zelle@example.com"
              fullWidth
            />
            <Input
              label="Zelle 수신인 이름"
              value={settings.zelleRecipientName}
              onChange={(e) => setSettings({ ...settings, zelleRecipientName: e.target.value })}
              placeholder="수신인 이름"
              fullWidth
            />
          </div>

          <div className="rounded-xl border border-gray-100 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">Venmo</h4>
            <Input
              label="Venmo 이메일 / 사용자명"
              type="text"
              value={settings.venmoEmail}
              onChange={(e) => setSettings({ ...settings, venmoEmail: e.target.value })}
              placeholder="@username 또는 venmo@example.com"
              fullWidth
            />
            <Input
              label="Venmo 수신인 이름"
              value={settings.venmoRecipientName}
              onChange={(e) => setSettings({ ...settings, venmoRecipientName: e.target.value })}
              placeholder="수신인 이름"
              fullWidth
            />
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              알림 템플릿에서는 <code>#{'{결제수단}'}</code>, <code>#{'{송금계정}'}</code>,{' '}
              <code>#{'{수취인명}'}</code> 을 쓰면 됩니다. 지금처럼 Zelle/Venmo만 쓰면 그 값만
              들어갑니다. 기존 심사본이 있다면 <code>#{'{은행명}'}</code>,{' '}
              <code>#{'{계좌번호}'}</code>, <code>#{'{예금주}'}</code> 도 계속 호환되지만, 운영
              입력은 Zelle/Venmo 기준으로만 관리하면 됩니다.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Cart & Shipping */}
      <SectionCard
        icon={ShoppingCart}
        title="장바구니/배송"
        sectionId="commerce"
        isOpen={expandedSections.commerce}
        onToggle={() => handleToggleSection('commerce')}
      >
        <div className="space-y-6">
          <div className="border border-gray-100 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">장바구니 타이머</h4>
            <Input
              label="기본 타이머 시간 (시간)"
              type="number"
              step="1"
              min={MIN_CART_TIMER_HOURS}
              max={MAX_CART_TIMER_HOURS}
              value={Math.max(
                MIN_CART_TIMER_HOURS,
                Math.ceil((settings.defaultCartTimerMinutes || 0) / MINUTES_PER_HOUR),
              )}
              onChange={(e) => {
                const parsedHours = parseInt(e.target.value, 10);
                const hours = Number.isFinite(parsedHours)
                  ? Math.min(
                      MAX_CART_TIMER_HOURS,
                      Math.max(MIN_CART_TIMER_HOURS, parsedHours || MIN_CART_TIMER_HOURS),
                    )
                  : MIN_CART_TIMER_HOURS;
                setSettings({ ...settings, defaultCartTimerMinutes: hours * MINUTES_PER_HOUR });
              }}
              fullWidth
            />
            <p className="text-xs text-gray-400 mt-2">1시간~120시간(최대 5일) 범위</p>
          </div>

          <div className="border border-gray-100 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">장바구니 리마인드 설정</h4>
            <div className="space-y-4 mb-4">
              <Input
                label="장기 미구매 장바구니 알림 기준 (시간)"
                type="number"
                min={1}
                max={168}
                value={settings.abandonedCartReminderHours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    abandonedCartReminderHours: Math.min(
                      168,
                      Math.max(1, parseInt(e.target.value || '24', 10) || 24),
                    ),
                  })
                }
                fullWidth
              />
              <p className="text-xs text-gray-500 mt-1">
                타이머 만료 기준이 아니라 장바구니에 담은 뒤 이 시간이 지나도 주문하지 않은 고객에게
                1회 알림을 보냅니다.
              </p>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">배송 설정</h4>
            <div className="space-y-4">
              <Input
                label="기본 배송비 — 동부 ($)"
                type="number"
                step="0.01"
                min={0}
                value={settings.defaultShippingFee}
                onChange={(e) =>
                  setSettings({ ...settings, defaultShippingFee: parseFloat(e.target.value) || 0 })
                }
                fullWidth
              />
              <Input
                label="CA/서부 배송비 ($)"
                type="number"
                step="0.01"
                min={0}
                value={settings.caShippingFee}
                onChange={(e) =>
                  setSettings({ ...settings, caShippingFee: parseFloat(e.target.value) || 0 })
                }
                fullWidth
              />
              <p className="text-xs text-gray-500 mt-1">
                무료배송 설정은 방송관리 페이지에서 방송별로 설정합니다.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Notification Settings */}
      <SectionCard
        icon={Bell}
        title="알림 설정"
        sectionId="notification"
        isOpen={expandedSections.notification}
        onToggle={() => handleToggleSection('notification')}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="alimtalkEnabled"
                    checked={settings.alimtalkEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, alimtalkEnabled: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF4D8D] focus:ring-[#FF4D8D]"
                  />
                  <div>
                    <label
                      htmlFor="alimtalkEnabled"
                      className="cursor-pointer text-sm font-semibold text-gray-800"
                    >
                      카카오 메시지 전체 활성화
                    </label>
                    <p className="mt-1 text-sm text-gray-500">
                      전체 스위치와 이벤트별 설정, 템플릿 코드, 테스트 발송을 이 화면에서 바로 관리합니다.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  상세페이지 없이 여기서 바로 저장/테스트까지 끝내는 구조입니다.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">주문 확인 묶음 발송 지연</h4>
                <p className="mt-1 text-sm text-gray-500">
                  라이브 주문만 방송 종료 후 묶어서 보냅니다. 일반 주문 즉시 발송에는 영향 없습니다.
                </p>
              </div>
              {settings.orderConfirmationDelayHours === 0 && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  종료 직후
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:max-w-xs">
                <Input
                  label="방송 종료 후 N시간"
                  type="number"
                  min={0}
                  max={168}
                  step="1"
                  value={settings.orderConfirmationDelayHours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      orderConfirmationDelayHours: Math.min(
                        168,
                        Math.max(0, parseInt(e.target.value || '0', 10) || 0),
                      ),
                    })
                  }
                  fullWidth
                />
              </div>
              <p className="pb-1 text-xs text-gray-500">
                0이면 방송 종료 직후 처리 대상으로 잡힙니다.
              </p>
            </div>
          </div>

          {notificationFeedback && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>{notificationFeedback}</span>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.4fr)_auto_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>이벤트</span>
              <span>상태</span>
              <span className="text-right">토글</span>
            </div>
            <div className="divide-y divide-gray-100">
              {visibleNotificationTemplates.map((template) => {
                const config = NOTIFICATION_VARIABLES[template.type];
                const isSavingToggle = notificationSavingId === template.id;
                const statusText = getNotificationStatusText(
                  settings.alimtalkEnabled,
                  template.enabled,
                );
                const isActive = activeNotificationTemplate?.id === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setActiveNotificationType(template.type)}
                    className={`grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition-colors md:grid-cols-[minmax(0,1.4fr)_auto_auto] md:items-center ${
                      isActive ? 'bg-pink-50/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{config.label}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            config.channel === 'AT'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}
                        >
                          {config.channel === 'AT' ? '알림톡' : '친구톡'}
                        </span>
                        {config.channel === 'AT' && !template.kakaoTemplateCode?.trim() && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            코드 미설정
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="md:justify-self-start">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          statusText === '켜짐'
                            ? 'bg-emerald-100 text-emerald-700'
                            : statusText === '전체 OFF'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-self-end">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={template.enabled}
                        disabled={isSavingToggle}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleNotificationToggle(template, !template.enabled);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          template.enabled ? 'bg-[#FF4D8D]' : 'bg-gray-300'
                        } ${isSavingToggle ? 'cursor-wait opacity-70' : ''}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            template.enabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeNotificationTemplate && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {NOTIFICATION_VARIABLES[activeNotificationTemplate.type].label}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    템플릿 코드 저장과 테스트 발송을 여기서 바로 처리합니다.
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {getNotificationStatusText(
                    settings.alimtalkEnabled,
                    activeNotificationTemplate.enabled,
                  )}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">카카오템플릿 코드</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={activeNotificationTemplate.kakaoTemplateCode ?? ''}
                    onChange={(event) =>
                      handleNotificationTemplateCodeChange(
                        activeNotificationTemplate.id,
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm transition-colors focus:border-[#FF4D8D] focus:outline-none focus:ring-2 focus:ring-pink-100"
                    placeholder="예: ORDER_CONFIRMATION"
                  />
                  <Button
                    variant="primary"
                    onClick={() => void handleNotificationTemplateSave(activeNotificationTemplate)}
                    disabled={notificationSavingId === activeNotificationTemplate.id}
                    className="sm:w-auto"
                  >
                    {notificationSavingId === activeNotificationTemplate.id ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1.5" />
                    )}
                    저장
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openNotificationTestModal(activeNotificationTemplate.type)}
                    className="sm:w-auto"
                  >
                    <MessageSquare className="w-4 h-4 mr-1.5" />
                    테스트 발송
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  카카오 심사 완료된 템플릿 코드만 입력하면 됩니다. 본문은 운영 심사본 기준으로
                  관리됩니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
      {/* Extended Sections */}
      <SectionCard
        icon={Package}
        title="포인트 설정"
        sectionId="points"
        isOpen={expandedSections.points}
        onToggle={() => handleToggleSection('points')}
      >
        <PointsConfiguration />
      </SectionCard>
      <SectionCard
        icon={SettingsIcon}
        title="공지 작성 관리"
        sectionId="noticeManagement"
        isOpen={expandedSections.noticeManagement}
        onToggle={() => handleToggleSection('noticeManagement')}
      >
        <NoticeManagement />
      </SectionCard>
      <SectionCard
        icon={SettingsIcon}
        title="공지 목록 관리"
        sectionId="noticeList"
        isOpen={expandedSections.noticeList}
        onToggle={() => handleToggleSection('noticeList')}
      >
        <NoticeListManagement />
      </SectionCard>

      <SectionCard
        icon={SettingsIcon}
        title="푸터 설정"
        sectionId="footer"
        isOpen={expandedSections.footer}
        onToggle={() => handleToggleSection('footer')}
      >
        <div className="space-y-4">
          <Input
            label="사업자등록번호"
            value={settings.businessRegistrationNumber}
            onChange={(e) =>
              setSettings({ ...settings, businessRegistrationNumber: e.target.value })
            }
            placeholder="000-00-00000"
            fullWidth
          />
          <Input
            label="사업장 주소"
            value={settings.businessAddress}
            onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
            placeholder="사업장 주소를 입력하세요"
            fullWidth
          />
          <Input
            label="통신판매업신고번호"
            value={settings.onlineSalesRegistrationNumber}
            onChange={(e) =>
              setSettings({ ...settings, onlineSalesRegistrationNumber: e.target.value })
            }
            placeholder="제 0000-지역-0000 호"
            fullWidth
          />
          <p className="text-xs text-gray-400">저장 후 사이트 푸터에 즉시 반영됩니다.</p>
        </div>
      </SectionCard>

      {notificationTestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">테스트 발송</h3>
              <button
                type="button"
                onClick={closeNotificationTestModal}
                className="rounded-lg p-1.5 hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              {NOTIFICATION_VARIABLES[notificationTestTarget].label} 템플릿으로 테스트 발송합니다.
            </p>

            <label className="mb-1.5 block text-sm font-medium text-gray-700">수신자 전화번호</label>
            <input
              type="text"
              value={notificationTestPhone}
              onChange={(event) => setNotificationTestPhone(event.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900"
              placeholder="01012345678"
            />

            {notificationTestMessage && (
              <p
                className={`mb-3 text-sm ${
                  notificationTestTone === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {notificationTestMessage}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeNotificationTestModal}>
                닫기
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSendNotificationTest()}
                disabled={isSendingNotificationTest || notificationTestPhone.trim().length === 0}
              >
                {isSendingNotificationTest ? (
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

      {/* Bottom Save */}
      <div className="sticky bottom-4">
        <div className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur p-3 shadow-sm">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full md:w-auto"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? '저장 중...' : '전체 설정 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
