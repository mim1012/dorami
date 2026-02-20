'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Megaphone, Inbox } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface NoticeConfig {
  text: string | null;
  fontSize: number;
  fontFamily: string;
}

interface UpdateNoticeDto {
  noticeText?: string | null;
  noticeFontSize?: number;
  noticeFontFamily?: string;
}

const FONT_FAMILIES = [
  { value: 'Pretendard', label: 'Pretendard (기본)' },
  { value: 'Arial', label: 'Arial' },
  { value: '"Noto Sans KR", sans-serif', label: 'Noto Sans KR' },
  { value: '"Malgun Gothic", sans-serif', label: '맑은 고딕' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'monospace', label: 'Monospace' },
];

/**
 * NoticeManagement Component
 * Admin interface for managing the live page notice box
 * Features: Text editing, font family selection, font size slider, live preview
 */
export function NoticeManagement() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Form state
  const [formData, setFormData] = useState<NoticeConfig>({
    text: '',
    fontSize: 14,
    fontFamily: 'Pretendard',
  });

  // Fetch current notice configuration
  const { data: currentNotice, isLoading } = useQuery<NoticeConfig>({
    queryKey: ['admin', 'config'],
    queryFn: async () => {
      const response = await apiClient.get<NoticeConfig>('/admin/config');
      return response.data;
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (currentNotice) {
      setFormData({
        text: currentNotice.text || '',
        fontSize: currentNotice.fontSize,
        fontFamily: currentNotice.fontFamily,
      });
    }
  }, [currentNotice]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (dto: UpdateNoticeDto) => {
      const response = await apiClient.put<NoticeConfig>('/admin/config', dto);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['notice', 'current'] });
      showToast('공지가 성공적으로 저장되었습니다!', 'success');
    },
    onError: (error: any) => {
      console.error('Failed to save notice:', error);
      if (error?.statusCode === 401) {
        showToast('세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
      } else if (error?.statusCode === 403) {
        showToast('관리자 권한이 없습니다.', 'error');
      } else {
        showToast('공지 저장에 실패했습니다. 다시 시도해주세요.', 'error');
      }
    },
  });

  // Reset mutation (clear notice)
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.put<NoticeConfig>('/admin/config', {
        noticeText: null,
        noticeFontSize: 14,
        noticeFontFamily: 'Pretendard',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['notice', 'current'] });
      setFormData({ text: '', fontSize: 14, fontFamily: 'Pretendard' });
      showToast('공지가 초기화되었습니다.', 'success');
    },
    onError: (error: any) => {
      console.error('Failed to reset notice:', error);
      if (error?.statusCode === 401) {
        showToast('세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
      } else if (error?.statusCode === 403) {
        showToast('관리자 권한이 없습니다.', 'error');
      } else {
        showToast('공지 초기화에 실패했습니다.', 'error');
      }
    },
  });

  const handleSave = () => {
    const dto: UpdateNoticeDto = {
      noticeText: formData.text || null,
      noticeFontSize: formData.fontSize,
      noticeFontFamily: formData.fontFamily,
    };
    saveMutation.mutate(dto);
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: '공지 초기화',
      message: '공지를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      confirmText: '초기화',
      cancelText: '취소',
      variant: 'danger',
    });
    if (confirmed) {
      resetMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-content-bg border border-gray-200 rounded-card p-6">
        <p className="text-secondary-text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary-text mb-2">공지 관리</h2>
        <p className="text-secondary-text">
          라이브 페이지 우측 사이드바에 표시될 공지를 설정하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form Controls */}
        <div className="bg-content-bg border border-gray-200 rounded-card p-6 space-y-6">
          <h3 className="text-lg font-semibold text-primary-text">공지 설정</h3>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">공지 내용</label>
            <textarea
              value={formData.text || ''}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              className="w-full h-48 px-4 py-3 bg-white border border-gray-200 rounded-lg text-primary-text placeholder:text-secondary-text focus:outline-none focus:border-hot-pink resize-none"
              placeholder="공지 내용을 입력하세요&#10;&#10;여러 줄 입력 가능합니다."
              style={{
                fontSize: `${formData.fontSize}px`,
                fontFamily: formData.fontFamily,
              }}
            />
            <p className="text-xs text-secondary-text mt-2">{(formData.text || '').length} 글자</p>
          </div>

          {/* Font Family Selector */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">글꼴</label>
            <select
              value={formData.fontFamily}
              onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-primary-text focus:outline-none focus:border-hot-pink appearance-none cursor-pointer"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size Slider */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              글자 크기: {formData.fontSize}px
            </label>
            <input
              type="range"
              min="10"
              max="24"
              step="1"
              value={formData.fontSize}
              onChange={(e) => setFormData({ ...formData, fontSize: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #ff007a 0%, #ff007a ${((formData.fontSize - 10) / 14) * 100}%, #e5e7eb ${((formData.fontSize - 10) / 14) * 100}%, #e5e7eb 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-secondary-text mt-1">
              <span>10px</span>
              <span>24px</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 px-6 py-3 bg-hot-pink hover:bg-hot-pink/90 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(255,0,122,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="px-6 py-3 bg-content-bg border border-gray-200 text-primary-text rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetMutation.isPending ? '초기화 중...' : '초기화'}
            </button>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">미리보기</h3>
          <p className="text-xs text-secondary-text mb-4">사용자에게 표시될 실제 모습입니다.</p>

          {/* Preview Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 min-h-[400px] flex flex-col">
            {/* Header */}
            <div className="mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-hot-pink flex items-center gap-2">
                <Megaphone className="w-5 h-5" aria-hidden="true" /> 공지
              </h3>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {formData.text ? (
                <p
                  className="whitespace-pre-wrap text-primary-text leading-relaxed"
                  style={{
                    fontSize: `${formData.fontSize}px`,
                    fontFamily: formData.fontFamily,
                  }}
                >
                  {formData.text}
                </p>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Inbox className="w-12 h-12 text-secondary-text/50 mb-3" aria-hidden="true" />
                  <p className="text-secondary-text text-sm">현재 공지가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
