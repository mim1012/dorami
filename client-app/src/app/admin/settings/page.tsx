'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Save, Settings as SettingsIcon, DollarSign, Bell, Loader2 } from 'lucide-react';
import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';
import { NoticeListManagement } from '@/components/admin/settings/NoticeListManagement';
import { PointsConfiguration } from '@/components/admin/settings/PointsConfiguration';
import { ShippingMessages } from '@/components/admin/settings/ShippingMessages';

export const dynamic = 'force-dynamic';

interface SystemSettings {
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

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
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
      <div className="min-h-screen py-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-hot-pink animate-spin" />
          <Body className="text-secondary-text">설정을 불러오는 중...</Body>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <Display className="text-hot-pink mb-2 flex items-center gap-3">
            <SettingsIcon className="w-10 h-10" />
            시스템 설정
          </Display>
          <Body className="text-secondary-text">플랫폼 전체 설정을 관리합니다</Body>
        </div>

        {successMessage && (
          <div className="bg-success-bg border border-success/20 rounded-button p-4 flex items-center gap-3">
            <Save className="w-5 h-5 text-success flex-shrink-0" />
            <Body className="text-success">{successMessage}</Body>
          </div>
        )}

        {error && (
          <div className="bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error}</Caption>
          </div>
        )}

        {/* Zelle Payment Settings */}
        <div className="bg-content-bg rounded-button p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-hot-pink" />
            <Heading2 className="text-primary-text">입금 정보 (Zelle)</Heading2>
          </div>
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
              label="Name (수신인)"
              value={settings.zelleRecipientName}
              onChange={(e) => setSettings({ ...settings, zelleRecipientName: e.target.value })}
              placeholder="수신인 이름"
              fullWidth
            />
            <Caption className="text-warning">
              입금 후 스크린샷 DM 또는 카톡 채널 전송 필수 (미확인 시 누락)
            </Caption>
          </div>
        </div>

        {/* Secondary Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shipping Settings */}
          <div className="bg-content-bg rounded-button p-6">
            <Heading2 className="text-primary-text mb-4">배송 설정</Heading2>
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
                  className="w-5 h-5 text-hot-pink focus:ring-hot-pink border-gray-300 rounded"
                />
                <label htmlFor="freeShippingEnabled" className="text-primary-text cursor-pointer">
                  <Body>무료배송 활성화</Body>
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
          </div>

          {/* Notification Settings */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-hot-pink" />
              <Heading2 className="text-primary-text">알림 설정</Heading2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={settings.emailNotificationsEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })
                  }
                  className="w-5 h-5 text-hot-pink focus:ring-hot-pink border-gray-300 rounded"
                />
                <label htmlFor="emailNotifications" className="text-primary-text cursor-pointer">
                  <Body>이메일 알림 활성화</Body>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Alimtalk Settings */}
        <div className="bg-content-bg rounded-button p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-hot-pink" />
            <Heading2 className="text-primary-text">알림톡 설정 (카카오 알림톡)</Heading2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="alimtalkEnabled"
                checked={settings.alimtalkEnabled}
                onChange={(e) => setSettings({ ...settings, alimtalkEnabled: e.target.checked })}
                className="w-5 h-5 text-hot-pink focus:ring-hot-pink border-gray-300 rounded"
              />
              <label htmlFor="alimtalkEnabled" className="text-primary-text cursor-pointer">
                <Body>알림톡 활성화</Body>
              </label>
            </div>
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
            <Caption className="text-secondary-text">
              솔라피(solapi.com)에서 발급받은 API Key와 Secret을 입력하세요. 카카오 채널 ID(pfId)는
              카카오 비즈니스 채널 등록 후 발급됩니다.
            </Caption>
          </div>
        </div>

        {/* Shipping Messages */}
        <ShippingMessages />

        {/* Reward Points Configuration */}
        <PointsConfiguration />

        {/* Notice Management Section */}
        <NoticeManagement />

        {/* Notice List Management Section */}
        <NoticeListManagement />

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button variant="primary" size="lg" onClick={handleSave} disabled={isSaving}>
            <Save className="w-5 h-5 mr-2" />
            {isSaving ? '저장 중...' : '전체 설정 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
