'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import {
  Save,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Bell,
  Loader2,
  MessageSquare,
} from 'lucide-react';

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  template: string;
  kakaoTemplateCode: string;
  createdAt: string;
  updatedAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  ORDER_CONFIRMATION: '주문 확인',
  PAYMENT_REMINDER: '입금 안내',
  PAYMENT_CONFIRMED: '입금 확인',
  SHIPPED: '배송 시작',
  RESERVATION_PROMOTED: '예약 전환',
  LIVE_START: '방송 시작',
};

function getAvailableVariables(type: string): string[] {
  const commonVars = ['{customerName}', '{orderId}'];
  switch (type) {
    case 'ORDER_CONFIRMATION':
    case 'PAYMENT_REMINDER':
      return [...commonVars, '{amount}', '{depositorName}'];
    case 'PAYMENT_CONFIRMED':
      return [...commonVars, '{amount}'];
    case 'SHIPPED':
      return [...commonVars, '{trackingNumber}'];
    case 'RESERVATION_PROMOTED':
      return [...commonVars, '{productName}'];
    case 'LIVE_START':
      return ['{streamTitle}'];
    default:
      return commonVars;
  }
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<NotificationTemplate[]>(
          '/admin/notification-templates',
        );
        setTemplates(response.data);
        if (response.data.length > 0) {
          setActiveTab(response.data[0].type);
        }
      } catch (err: any) {
        console.error('Failed to fetch templates:', err);
        setError('템플릿을 불러오지 못했습니다');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleTemplateChange = (
    id: string,
    field: 'template' | 'kakaoTemplateCode',
    value: string,
  ) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSave = async (template: NotificationTemplate) => {
    setSavingId(template.id);
    setError(null);
    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        template: template.template,
        kakaoTemplateCode: template.kakaoTemplateCode,
      });
      setSuccessId(template.id);
      setTimeout(() => setSuccessId(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '저장에 실패했습니다');
    } finally {
      setSavingId(null);
    }
  };

  const activeTemplate = templates.find((t) => t.type === activeTab);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#FF4D8D] animate-spin" />
          <p className="text-sm text-gray-500">템플릿을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/settings')}
          className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-[#FF4D8D]" />
            알림 템플릿 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            고객에게 발송되는 카카오 알림톡 메시지를 관리합니다
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            등록된 알림 템플릿이 없습니다. 시스템 초기화 후 자동으로 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* Event Tabs */}
          <div className="border-b border-gray-100 overflow-x-auto">
            <div className="flex">
              {templates.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setActiveTab(t.type)}
                  className={`px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === t.type
                      ? 'border-[#FF4D8D] text-[#FF4D8D] bg-pink-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {EVENT_TYPE_LABELS[t.type] || t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          {activeTemplate && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {EVENT_TYPE_LABELS[activeTemplate.type] || activeTemplate.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{activeTemplate.type}</p>
                </div>
                <div className="flex items-center gap-3">
                  {successId === activeTemplate.id && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      저장됨
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
                    {savingId === activeTemplate.id ? '저장 중...' : '저장하기'}
                  </Button>
                </div>
              </div>

              <div className="space-y-5">
                {/* Kakao Template Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    카카오 템플릿 코드
                  </label>
                  <input
                    type="text"
                    value={activeTemplate.kakaoTemplateCode || ''}
                    onChange={(e) =>
                      handleTemplateChange(activeTemplate.id, 'kakaoTemplateCode', e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D] transition-colors"
                    placeholder="예: KA01TP..."
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    카카오 비즈니스 센터에서 심사 승인 후 받은 템플릿 코드를 입력하세요
                  </p>
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    메시지 본문
                  </label>
                  <textarea
                    value={activeTemplate.template}
                    onChange={(e) =>
                      handleTemplateChange(activeTemplate.id, 'template', e.target.value)
                    }
                    rows={8}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D] resize-none transition-colors"
                    placeholder="알림 메시지 내용을 입력하세요..."
                  />
                </div>

                {/* Available Variables */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-2">사용 가능한 변수</p>
                  <div className="flex flex-wrap gap-2">
                    {getAvailableVariables(activeTemplate.type).map((variable) => (
                      <code
                        key={variable}
                        className="px-2 py-1 bg-white border border-blue-200 text-blue-700 rounded text-xs font-mono cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => {
                          const textarea = document.querySelector('textarea');
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const newValue =
                              activeTemplate.template.substring(0, start) +
                              variable +
                              activeTemplate.template.substring(end);
                            handleTemplateChange(activeTemplate.id, 'template', newValue);
                          }
                        }}
                      >
                        {variable}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 mt-2">
                    변수를 클릭하면 커서 위치에 삽입됩니다
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pb-8">
        <Button variant="outline" onClick={() => router.push('/admin/settings')}>
          <ChevronLeft className="w-4 h-4 mr-1.5" />
          설정으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
