'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  businessRegistrationNumber: string;
  businessAddress: string;
  onlineSalesRegistrationNumber: string;
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
  const router = useRouter();
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const settingsResponse = await apiClient.get<SystemSettings>('/admin/config/settings');

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
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        setError('설정을 불러오는데 실패했습니다');
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
              이 화면에서는 알림 전체 사용 여부만 관리합니다. 템플릿 코드는 전용 화면에서
              수정합니다.
            </p>

            {settings.alimtalkEnabled && (
              <p className="text-xs text-gray-400">
                비즈고(Bizgo) API를 통해 카카오 알림톡이 발송됩니다. API 인증 정보는 서버 환경변수로
                관리됩니다.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900">
                템플릿 관리는 전용 화면에서만 수정
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                카카오 심사 완료된 본문은 이 화면에서 수정하지 않습니다. 관리자 설정에서는
                결제/운영값만 저장하고, 템플릿 코드는 전용 알림 페이지에서 관리합니다.
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1">
              <p>인보이스 알림: 결제 정보 변수 치환만 반영</p>
              <p>장바구니 리마인더: 상품/수량/고객명 자동 치환</p>
              <p>라이브 시작 알림: 방송 제목/설명/URL 자동 치환</p>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => router.push('/admin/settings/notifications')}
              >
                템플릿 코드 관리로 이동
              </Button>
            </div>
          </div>
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
