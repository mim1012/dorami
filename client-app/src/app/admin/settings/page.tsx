'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Save, Settings as SettingsIcon, DollarSign, Clock, Bell } from 'lucide-react';
import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';
import { PointsConfiguration } from '@/components/admin/settings/PointsConfiguration';
import { ShippingMessages } from '@/components/admin/settings/ShippingMessages';

export const dynamic = 'force-dynamic';

interface SystemSettings {
  defaultCartTimerMinutes: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  defaultShippingFee: number;
  kakaoTalkApiKey: string;
  emailNotificationsEnabled: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    defaultCartTimerMinutes: 10,
    bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'KB국민은행',
    bankAccountNumber: '1234567890123456',
    bankAccountHolder: '도라미 라이브커머스',
    defaultShippingFee: 3000,
    kakaoTalkApiKey: '',
    emailNotificationsEnabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Note: This would call actual API endpoint when backend is implemented
      // await apiClient.put('/admin/system-settings', settings);

      setSuccessMessage('설정이 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.response?.data?.message || '설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <Display className="text-hot-pink mb-2 flex items-center gap-3">
            <SettingsIcon className="w-10 h-10" />
            시스템 설정
          </Display>
          <Body className="text-secondary-text">플랫폼 전체 설정을 관리합니다</Body>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-button p-4 flex items-center gap-3">
            <Save className="w-5 h-5 text-green-600 flex-shrink-0" />
            <Body className="text-green-800">{successMessage}</Body>
          </div>
        )}

        {error && (
          <div className="bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error}</Caption>
          </div>
        )}

        {/* Cart Timer Settings */}
        <div className="bg-content-bg rounded-button p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-hot-pink" />
            <Heading2 className="text-primary-text">장바구니 예약 타이머</Heading2>
          </div>
          <div className="space-y-4">
            <Input
              label="기본 타이머 시간 (분)"
              type="number"
              min={1}
              max={60}
              value={settings.defaultCartTimerMinutes}
              onChange={(e) =>
                setSettings({ ...settings, defaultCartTimerMinutes: parseInt(e.target.value) || 10 })
              }
              fullWidth
            />
            <Caption className="text-secondary-text">
              상품을 장바구니에 담은 후 결제를 완료해야 하는 시간 (1~60분)
            </Caption>
          </div>
        </div>

        {/* Bank Account Settings */}
        <div className="bg-content-bg rounded-button p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-hot-pink" />
            <Heading2 className="text-primary-text">무통장 입금 정보</Heading2>
          </div>
          <div className="space-y-4">
            <Input
              label="은행명"
              value={settings.bankName}
              onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
              fullWidth
            />
            <Input
              label="계좌번호"
              value={settings.bankAccountNumber}
              onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
              fullWidth
            />
            <Input
              label="예금주"
              value={settings.bankAccountHolder}
              onChange={(e) => setSettings({ ...settings, bankAccountHolder: e.target.value })}
              fullWidth
            />
          </div>
        </div>

        {/* Shipping Settings */}
        <div className="bg-content-bg rounded-button p-6">
          <Heading2 className="text-primary-text mb-4">배송 설정</Heading2>
          <div className="space-y-4">
            <Input
              label="기본 배송비 (원)"
              type="number"
              step="0.01"
              min={0}
              value={settings.defaultShippingFee}
              onChange={(e) =>
                setSettings({ ...settings, defaultShippingFee: parseFloat(e.target.value) || 0 })
              }
              fullWidth
            />
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-content-bg rounded-button p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-hot-pink" />
            <Heading2 className="text-primary-text">알림 설정</Heading2>
          </div>
          <div className="space-y-4">
            <Input
              label="카카오톡 API 키"
              type="password"
              value={settings.kakaoTalkApiKey}
              onChange={(e) => setSettings({ ...settings, kakaoTalkApiKey: e.target.value })}
              placeholder="카카오톡 API 키를 입력하세요"
              fullWidth
            />
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

        {/* Shipping Messages */}
        <ShippingMessages />

        {/* Reward Points Configuration */}
        <PointsConfiguration />

        {/* Notice Management Section */}
        <NoticeManagement />

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
