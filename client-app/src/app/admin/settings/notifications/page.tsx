'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ChevronLeft,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  Save,
} from 'lucide-react';
import {
  NOTIFICATION_TEMPLATE_VARIABLES,
  type NotificationTemplateType,
  type NotificationVariableDefinition,
  type NotificationVariableSourceType,
} from '@live-commerce/shared-types';

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
  RESERVATION_PROMOTED: '예약 전환',
  CART_EXPIRING: '장바구니 만료 임박',
  SHIPPING_STARTED: '배송 시작',
  ORDER_CREATED: '주문 생성',
  LIVE_START: '방송 시작',
};

const PLACEHOLDER_PATTERN = /#\{[^}]+\}|\{\{[^}]+\}\}|\{[^}]+\}/g;

const SOURCE_BADGE_STYLES: Record<NotificationVariableSourceType, string> = {
  event: 'bg-blue-50 text-blue-700 border-blue-200',
  system: 'bg-violet-50 text-violet-700 border-violet-200',
  computed: 'bg-amber-50 text-amber-700 border-amber-200',
};

const SOURCE_LABELS: Record<NotificationVariableSourceType, string> = {
  event: '이벤트 데이터',
  system: '시스템 설정',
  computed: '계산/가공 값',
};

const CHANNEL_LABELS = {
  AT: '알림톡',
  FT: '친구톡',
} as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTemplatePlaceholders(template: string): string[] {
  return Array.from(new Set(template.match(PLACEHOLDER_PATTERN) ?? []));
}

function getTemplateVariables(type: string, template: string): NotificationVariableDefinition[] {
  const knownVariables = NOTIFICATION_TEMPLATE_VARIABLES[type as NotificationTemplateType]?.variables ?? [];
  const variablesByPlaceholder = new Map(knownVariables.map((variable) => [variable.key, variable]));
  const placeholdersInTemplate = extractTemplatePlaceholders(template);

  if (placeholdersInTemplate.length === 0) {
    return knownVariables;
  }

  const usedVariables = placeholdersInTemplate.map(
    (placeholder): NotificationVariableDefinition =>
      variablesByPlaceholder.get(placeholder) ?? {
        key: placeholder,
        label: placeholder,
        description: '공유 메타데이터에 아직 설명이 등록되지 않은 변수입니다.',
        sourceType: 'event',
        sourcePath: 'unknown',
        required: true,
        sample: '샘플 값 미정',
      },
  );

  const missingButSupported = knownVariables.filter(
    (variable) => !placeholdersInTemplate.includes(variable.key),
  );

  return [...usedVariables, ...missingButSupported];
}

function buildSamplePreview(template: string, variables: NotificationVariableDefinition[]): string {
  return variables.reduce(
    (message, variable) =>
      message.replace(new RegExp(escapeRegExp(variable.key), 'g'), variable.sample),
    template,
  );
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
        const response = await apiClient.get<NotificationTemplate[]>('/admin/notification-templates');
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
    setTemplates((prev) => prev.map((template) => (template.id === id ? { ...template, [field]: value } : template)));
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

  const activeTemplate = templates.find((template) => template.type === activeTab);

  const activeTemplateDefinition = useMemo(() => {
    if (!activeTemplate) {
      return undefined;
    }

    return NOTIFICATION_TEMPLATE_VARIABLES[activeTemplate.type as NotificationTemplateType];
  }, [activeTemplate]);

  const activeTemplateVariables = useMemo(() => {
    if (!activeTemplate) {
      return [];
    }

    return getTemplateVariables(activeTemplate.type, activeTemplate.template);
  }, [activeTemplate]);

  const samplePreview = useMemo(() => {
    if (!activeTemplate) {
      return '';
    }

    return buildSamplePreview(activeTemplate.template, activeTemplateVariables);
  }, [activeTemplate, activeTemplateVariables]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF4D8D]" />
          <p className="text-sm text-gray-500">템플릿을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
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
            알림 템플릿 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            고객에게 발송되는 카카오 알림 메시지를 확인하고 템플릿 코드를 관리합니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-16 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">
            등록된 알림 템플릿이 없습니다. 시스템 초기화 후 자동으로 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <div className="overflow-x-auto border-b border-gray-100">
            <div className="flex">
              {templates.map((template) => (
                <button
                  key={template.type}
                  onClick={() => setActiveTab(template.type)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-5 py-4 text-sm font-medium transition-colors ${
                    activeTab === template.type
                      ? 'border-[#FF4D8D] bg-pink-50/50 text-[#FF4D8D]'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {EVENT_TYPE_LABELS[template.type] || template.name}
                </button>
              ))}
            </div>
          </div>

          {activeTemplate && (
            <div className="space-y-6 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">
                      {EVENT_TYPE_LABELS[activeTemplate.type] || activeTemplate.name}
                    </h3>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                      {activeTemplate.type}
                    </span>
                    {activeTemplateDefinition && (
                      <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-[#FF4D8D]">
                        {CHANNEL_LABELS[activeTemplateDefinition.channel]}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    변수 안내와 샘플 값을 참고해 카카오 심사본과 실제 치환 데이터를 함께 검토하세요.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {successId === activeTemplate.id && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
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
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    {savingId === activeTemplate.id ? '저장 중...' : '저장하기'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      카카오 템플릿 코드
                    </label>
                    <input
                      type="text"
                      value={activeTemplate.kakaoTemplateCode || ''}
                      onChange={(event) =>
                        handleTemplateChange(activeTemplate.id, 'kakaoTemplateCode', event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm transition-colors focus:border-[#FF4D8D] focus:outline-none focus:ring-2 focus:ring-pink-100"
                      placeholder="예: KA01TP..."
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      카카오 비즈니스 센터에서 심사 승인 후 받은 템플릿 코드를 입력하세요.
                    </p>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium text-gray-700">메시지 본문</label>
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                        <Lock className="h-3.5 w-3.5" />
                        읽기 전용
                      </span>
                    </div>
                    <textarea
                      value={activeTemplate.template}
                      readOnly
                      rows={10}
                      className="w-full resize-none rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 font-mono text-sm text-gray-700 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      본문은 백엔드 치환 로직 및 카카오 심사본과 동일하게 유지되어야 하므로 이 화면에서는 수정할 수 없습니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                      <div className="space-y-1 text-sm text-blue-800">
                        <p className="font-semibold">운영 가이드</p>
                        <p>
                          아래 변수는 실제 발송 시 이벤트 데이터, 시스템 설정값, 계산값으로 자동 치환됩니다.
                          LIVE_START의 쇼핑몰명은 별도 설정 UI 없이 백엔드에서 Doremi Market으로 고정됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">샘플 치환 미리보기</p>
                    <p className="mt-1 text-xs text-gray-500">
                      공유 메타데이터의 샘플 값으로 치환한 예시입니다. 실제 발송 값은 주문/방송 데이터에 따라 달라질 수 있습니다.
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 font-sans text-sm leading-6 text-gray-700">
                      {samplePreview || activeTemplate.template}
                    </pre>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">사용 변수 안내</p>
                      <p className="mt-1 text-xs text-gray-500">
                        설명, 데이터 출처, 샘플 값, 필수 여부를 함께 제공합니다.
                      </p>
                    </div>

                    <div className="space-y-3 p-4">
                      {activeTemplateVariables.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                          등록된 변수 메타데이터가 없습니다.
                        </div>
                      ) : (
                        activeTemplateVariables.map((variable) => {
                          const isUsedInTemplate = activeTemplate.template.includes(variable.key);

                          return (
                            <div
                              key={`${activeTemplate.type}-${variable.key}`}
                              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <code className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-gray-800">
                                      {variable.key}
                                    </code>
                                    {variable.required && (
                                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                        필수
                                      </span>
                                    )}
                                    {!isUsedInTemplate && (
                                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                                        현재 본문 미사용
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900">{variable.label}</p>
                                  <p className="text-sm text-gray-700">{variable.description}</p>
                                </div>
                                <span
                                  className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SOURCE_BADGE_STYLES[variable.sourceType]}`}
                                >
                                  {SOURCE_LABELS[variable.sourceType]}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                    값 출처
                                  </p>
                                  <p className="mt-1 break-all text-sm text-gray-700">{variable.sourcePath}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                    샘플 값
                                  </p>
                                  <p className="mt-1 break-all text-sm text-gray-700">{variable.sample}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pb-8">
        <Button variant="outline" onClick={() => router.push('/admin/settings')}>
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          설정으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
