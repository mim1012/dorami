'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
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
} from 'lucide-react';
import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';
import { NoticeListManagement } from '@/components/admin/settings/NoticeListManagement';
import { PointsConfiguration } from '@/components/admin/settings/PointsConfiguration';
import { ShippingMessages } from '@/components/admin/settings/ShippingMessages';

export const dynamic = 'force-dynamic';

interface SystemSettings {
  defaultCartTimerMinutes: number;
  defaultShippingFee: number;
  caShippingFee: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  zelleEmail: string;
  zelleRecipientName: string;
  emailNotificationsEnabled: boolean;
  alimtalkEnabled: boolean;
  solapiApiKey: string;
  solapiApiSecret: string;
  kakaoChannelId: string;
}

const MIN_CART_TIMER_HOURS = 1;
const MAX_CART_TIMER_HOURS = 120;
const MINUTES_PER_HOUR = 60;

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-pink-50 rounded-lg">
          <Icon className="w-5 h-5 text-[#FF4D8D]" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    defaultCartTimerMinutes: 60,
    defaultShippingFee: 10,
    caShippingFee: 8,
    freeShippingEnabled: false,
    freeShippingThreshold: 150,
    zelleEmail: '',
    zelleRecipientName: '',
    emailNotificationsEnabled: true,
    alimtalkEnabled: false,
    solapiApiKey: '',
    solapiApiSecret: '',
    kakaoChannelId: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const { data } = await apiClient.get<SystemSettings>('/admin/config/settings');
        setSettings(data);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-[#FF4D8D]" />
            시스템 설정
          </h1>
          <p className="text-sm text-gray-500 mt-1">플랫폼 전체 설정을 관리합니다</p>
        </div>
        <Button variant="primary" size="lg" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? '저장 중...' : '전체 저장'}
        </Button>
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

      {/* Zelle Payment Settings */}
      <SectionCard icon={DollarSign} title="입금 정보 (Zelle)">
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
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              입금 후 스크린샷 DM 또는 카톡 채널 전송 필수 (미확인 시 누락)
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Cart & Shipping Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cart Timer */}
        <SectionCard icon={ShoppingCart} title="장바구니 타이머">
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
        </SectionCard>

        {/* Shipping Settings */}
        <SectionCard icon={Package} title="배송 설정">
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
            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="freeShippingEnabled"
                checked={settings.freeShippingEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, freeShippingEnabled: e.target.checked })
                }
                className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
              />
              <label htmlFor="freeShippingEnabled" className="text-sm text-gray-700 cursor-pointer">
                무료배송 활성화
              </label>
            </div>
            {settings.freeShippingEnabled && (
              <Input
                label="무료배송 기준금액 ($)"
                type="number"
                step="0.01"
                min={0}
                value={settings.freeShippingThreshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    freeShippingThreshold: parseFloat(e.target.value) || 0,
                  })
                }
                fullWidth
              />
            )}
          </div>
        </SectionCard>
      </div>

      {/* Notification Settings */}
      <SectionCard icon={Bell} title="알림 설정">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="emailNotifications"
              checked={settings.emailNotificationsEnabled}
              onChange={(e) =>
                setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })
              }
              className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
            />
            <label htmlFor="emailNotifications" className="text-sm text-gray-700 cursor-pointer">
              이메일 알림 활성화
            </label>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="alimtalkEnabled"
                checked={settings.alimtalkEnabled}
                onChange={(e) => setSettings({ ...settings, alimtalkEnabled: e.target.checked })}
                className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
              />
              <label
                htmlFor="alimtalkEnabled"
                className="text-sm font-medium text-gray-700 cursor-pointer"
              >
                카카오 알림톡 활성화
              </label>
            </div>

            {settings.alimtalkEnabled && (
              <div className="space-y-4 pl-7">
                <Input
                  label="솔라피 API Key"
                  type="text"
                  value={settings.solapiApiKey}
                  onChange={(e) => setSettings({ ...settings, solapiApiKey: e.target.value })}
                  fullWidth
                />
                <Input
                  label="솔라피 API Secret"
                  type="password"
                  value={settings.solapiApiSecret}
                  onChange={(e) => setSettings({ ...settings, solapiApiSecret: e.target.value })}
                  placeholder={
                    settings.solapiApiSecret === '••••••••' ? '저장된 시크릿 (변경 시 입력)' : ''
                  }
                  fullWidth
                />
                <Input
                  label="카카오 채널 ID (pfId)"
                  type="text"
                  value={settings.kakaoChannelId}
                  onChange={(e) => setSettings({ ...settings, kakaoChannelId: e.target.value })}
                  fullWidth
                />
                <p className="text-xs text-gray-400">
                  솔라피(solapi.com)에서 발급받은 API Key와 Secret을 입력하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Extended Sections */}
      <ShippingMessages />
      <PointsConfiguration />
      <NoticeManagement />
      <NoticeListManagement />

      {/* Bottom Save */}
      <div className="flex justify-end pb-8">
        <Button variant="primary" size="lg" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? '저장 중...' : '전체 설정 저장'}
        </Button>
      </div>
    </div>
  );
}
