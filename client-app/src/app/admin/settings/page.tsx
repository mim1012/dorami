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
} from 'lucide-react';
import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';
import { NoticeListManagement } from '@/components/admin/settings/NoticeListManagement';
import { PointsConfiguration } from '@/components/admin/settings/PointsConfiguration';
import { ShippingMessages } from '@/components/admin/settings/ShippingMessages';

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  template: string;
  kakaoTemplateCode: string;
  createdAt: string;
  updatedAt: string;
}

export const dynamic = 'force-dynamic';

interface SystemSettings {
  defaultCartTimerMinutes: number;
  defaultShippingFee: number;
  caShippingFee: number;
  zelleEmail: string;
  zelleRecipientName: string;
  venmoEmail: string;
  venmoRecipientName: string;
  alimtalkEnabled: boolean;
  businessRegistrationNumber: string;
  businessAddress: string;
  onlineSalesRegistrationNumber: string;
}

const MIN_CART_TIMER_HOURS = 1;
const MAX_CART_TIMER_HOURS = 120;
const MINUTES_PER_HOUR = 60;

type NotificationEventType = 'ORDER_CONFIRMATION' | 'SHIPPING_STARTED';

const NOTIFICATION_EVENT_GROUPS: Array<{
  type: NotificationEventType;
  label: string;
  description: string;
}> = [
  {
    type: 'ORDER_CONFIRMATION',
    label: '주문 완료 알림',
    description: '주문 완료 시 발송',
  },
  {
    type: 'SHIPPING_STARTED',
    label: '배송 시작 알림',
    description: '배송 시작 시 발송',
  },
];

const EVENT_PREVIEW_VARIABLES: Record<string, Record<string, string>> = {
  ORDER_CONFIRMATION: {
    customerName: '김민수',
    orderId: 'ORD-20260308-10001',
    amount: '$12.00',
  },
  SHIPPING_STARTED: {
    customerName: '김민수',
    orderId: 'ORD-20260308-10001',
    trackingNumber: 'DOR-123456789',
  },
};

const FALLBACK_VARIABLES: Record<string, string> = {
  customerName: '고객님',
  orderId: 'ORD-20260308-00001',
  amount: '$0',
  depositorName: '입금자명',
  trackingNumber: 'TRK-000000',
  reservationNumber: 'RES-0000',
  productName: '상품명',
};

function buildTemplatePreview(type: string, template: string): string {
  const variables = EVENT_PREVIEW_VARIABLES[type] || FALLBACK_VARIABLES;
  let text = template;
  for (const [key, value] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return text;
}

type SectionKey =
  | 'payment'
  | 'commerce'
  | 'notification'
  | 'shippingMessages'
  | 'points'
  | 'noticeManagement'
  | 'noticeList'
  | 'footer';

const DEFAULT_SECTION_STATE: Record<SectionKey, boolean> = {
  payment: true,
  commerce: true,
  notification: true,
  shippingMessages: false,
  points: false,
  noticeManagement: false,
  noticeList: false,
  footer: false,
};

const SECTION_NAV: { key: SectionKey; label: string; icon: typeof DollarSign }[] = [
  { key: 'payment', label: '입금', icon: DollarSign },
  { key: 'commerce', label: '장바구니/배송', icon: ShoppingCart },
  { key: 'notification', label: '알림', icon: Bell },
  { key: 'shippingMessages', label: '배송안내', icon: Package },
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
    defaultShippingFee: 10,
    caShippingFee: 8,
    zelleEmail: '',
    zelleRecipientName: '',
    venmoEmail: '',
    venmoRecipientName: '',
    alimtalkEnabled: false,
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
  const [notificationTemplateByType, setNotificationTemplateByType] = useState<
    Record<string, string>
  >({});
  const [isTemplateEnabled, setIsTemplateEnabled] = useState<Record<string, boolean>>({});
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const [settingsResponse, templatesResponse] = await Promise.all([
          apiClient.get<SystemSettings>('/admin/config/settings'),
          apiClient.get<NotificationTemplate[]>('/admin/notification-templates'),
        ]);
        const templates = templatesResponse.data || [];
        const nextByType: Record<string, string> = {};
        const nextTemplateEnabled: Record<string, boolean> = {};

        NOTIFICATION_EVENT_GROUPS.forEach((event) => {
          nextByType[event.type] = '';
          nextTemplateEnabled[event.type] = false;
        });

        for (const template of templates) {
          if (!NOTIFICATION_EVENT_GROUPS.some((event) => event.type === template.type)) {
            continue;
          }
          if (!nextByType[template.type]) {
            nextByType[template.type] = template.id;
          }
          nextTemplateEnabled[template.type] = true;
        }

        setSettings({
          ...settingsResponse.data,
          venmoEmail: settingsResponse.data.venmoEmail ?? '',
          venmoRecipientName: settingsResponse.data.venmoRecipientName ?? '',
        });
        setNotificationTemplates(templates);
        setNotificationTemplateByType(nextByType);
        setIsTemplateEnabled(nextTemplateEnabled);
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        setError('설정을 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleTemplateFieldChange = (
    id: string,
    field: keyof NotificationTemplate,
    value: string,
  ) => {
    setNotificationTemplates((prev) =>
      prev.map((template) => (template.id === id ? { ...template, [field]: value } : template)),
    );
  };

  const handleTemplateSelect = (type: string, templateId: string) => {
    setNotificationTemplateByType((prev) => ({
      ...prev,
      [type]: templateId,
    }));
  };

  const getTemplatesByType = (type: string) =>
    notificationTemplates.filter((template) => template.type === type);

  const getActiveTemplate = (type: string): NotificationTemplate | undefined => {
    const selected = notificationTemplateByType[type];
    const list = getTemplatesByType(type);
    return list.find((template) => template.id === selected) ?? list[0];
  };

  const handleTemplateSave = async (template: NotificationTemplate) => {
    setSavingTemplateId(template.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        template: template.template,
        kakaoTemplateCode: template.kakaoTemplateCode,
      });
      setSuccessMessage('알림 템플릿이 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || '알림 템플릿 저장에 실패했습니다');
    } finally {
      setSavingTemplateId(null);
    }
  };

  const handleTemplateToggle = (type: string, enabled: boolean) => {
    setIsTemplateEnabled((prev) => ({
      ...prev,
      [type]: enabled,
    }));
  };

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
          <Input
            label="Zelle 이메일"
            type="email"
            value={settings.zelleEmail}
            onChange={(e) => setSettings({ ...settings, zelleEmail: e.target.value })}
            placeholder="zelle@example.com"
            fullWidth
          />
          <Input
            label="수신인 이름"
            value={settings.zelleRecipientName}
            onChange={(e) => setSettings({ ...settings, zelleRecipientName: e.target.value })}
            placeholder="수신인 이름"
            fullWidth
          />
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
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              입금 후 스크린샷 DM 또는 카톡 채널 전송 필수 (미확인 시 누락)
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
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="alimtalkEnabled"
                checked={settings.alimtalkEnabled}
                onChange={(e) => setSettings({ ...settings, alimtalkEnabled: e.target.checked })}
                className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
              />
              <div>
                <label
                  htmlFor="alimtalkEnabled"
                  className="text-sm font-semibold text-gray-700 cursor-pointer"
                >
                  카카오 알림톡 활성화
                </label>
                <p className="text-xs text-gray-500">
                  이벤트별 알림톡 발송을 제어하고 템플릿을 관리합니다.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              알림 설정은 아래 이벤트 단위로 관리하며, ON/OFF를 끈 이벤트는 자동 발송되지 않습니다.
            </p>

            {settings.alimtalkEnabled && (
              <p className="text-xs text-gray-400">
                비즈고(Bizgo) API를 통해 카카오 알림톡이 발송됩니다. API 인증 정보는 서버 환경변수로
                관리됩니다.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {NOTIFICATION_EVENT_GROUPS.map((event) => {
              const templates = getTemplatesByType(event.type);
              const activeTemplate = getActiveTemplate(event.type);
              const isEnabled = !!isTemplateEnabled[event.type];
              const isEditable = settings.alimtalkEnabled && isEnabled;

              return (
                <div key={event.type} className="border border-gray-200 rounded-xl bg-white">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{event.label}</h4>
                      <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        id={`template-${event.type}`}
                        checked={isEnabled}
                        onChange={(e) => handleTemplateToggle(event.type, e.target.checked)}
                        className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
                        disabled={!settings.alimtalkEnabled}
                      />
                      ON/OFF
                    </label>
                  </div>

                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        템플릿 선택
                      </label>
                      <select
                        value={activeTemplate?.id ?? ''}
                        onChange={(e) => handleTemplateSelect(event.type, e.target.value)}
                        disabled={!isEditable}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {templates.length === 0 ? (
                          <option value="">템플릿이 없습니다</option>
                        ) : (
                          templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {activeTemplate ? (
                      <>
                        <Input
                          label="카카오 템플릿 코드"
                          type="text"
                          value={activeTemplate.kakaoTemplateCode || ''}
                          onChange={(e) =>
                            handleTemplateFieldChange(
                              activeTemplate.id,
                              'kakaoTemplateCode',
                              e.target.value,
                            )
                          }
                          fullWidth
                          disabled={!isEditable}
                        />
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            메시지 본문
                          </label>
                          <textarea
                            value={activeTemplate.template}
                            onChange={(e) =>
                              handleTemplateFieldChange(
                                activeTemplate.id,
                                'template',
                                e.target.value,
                              )
                            }
                            rows={4}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D] disabled:bg-gray-100 disabled:text-gray-400 resize-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            미리보기
                          </label>
                          <textarea
                            value={buildTemplatePreview(event.type, activeTemplate.template)}
                            rows={3}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-500">
                            사용중 템플릿: {activeTemplate.name}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTemplateSave(activeTemplate)}
                            disabled={savingTemplateId === activeTemplate.id || !isEditable}
                          >
                            {savingTemplateId === activeTemplate.id ? '저장 중...' : '저장'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        해당 이벤트에 연결된 템플릿이 없습니다. 템플릿을 먼저 등록해 주세요.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>
      {/* Extended Sections */}
      <SectionCard
        icon={Package}
        title="배송 안내 메시지"
        sectionId="shippingMessages"
        isOpen={expandedSections.shippingMessages}
        onToggle={() => handleToggleSection('shippingMessages')}
      >
        <ShippingMessages />
      </SectionCard>
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
