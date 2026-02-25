'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, X, Inbox } from 'lucide-react';
import { getActiveNotices, type Notice } from '@/lib/api/notices';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isNew(notice: Notice): boolean {
  return Date.now() - new Date(notice.createdAt).getTime() < SEVEN_DAYS_MS;
}

function formatRelativeDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '1일 전';
  return `${diffDays}일 전`;
}

export function NoticeModal({ isOpen, onClose }: NoticeModalProps) {
  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ['notices', 'active'],
    queryFn: getActiveNotices,
    staleTime: 60_000,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="공지사항"
        className="fixed inset-x-0 bottom-0 z-50 bg-[#12121e] rounded-t-3xl animate-slide-up-sheet max-h-[75vh] flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            공지사항
            {notices.length > 0 && (
              <span className="text-white/40 text-sm font-normal">{notices.length}개</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#FF007A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Inbox className="w-10 h-10 text-white/20 mb-2" aria-hidden="true" />
              <p className="text-white/40 text-sm">공지사항이 없습니다</p>
            </div>
          ) : (
            notices.map((notice) => (
              <div key={notice.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  {notice.category === 'IMPORTANT' && (
                    <AlertCircle
                      className="w-4 h-4 text-[#FF007A] flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white text-sm leading-snug">
                        {notice.title}
                      </p>
                      {isNew(notice) && (
                        <span className="text-[9px] font-bold text-[#FF007A] bg-[#FF007A]/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm whitespace-pre-wrap leading-relaxed">
                      {notice.content}
                    </p>
                    <p className="text-white/30 text-xs mt-2 text-right">
                      {formatRelativeDate(notice.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
