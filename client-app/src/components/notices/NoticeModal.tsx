'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Inbox, Megaphone, Info } from 'lucide-react';
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

function ImportantCard({ notice }: { notice: Notice }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Pink gradient border via background layer */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#FF007A] via-[#FF4D8D] to-[#FF007A]/40 p-px">
        <div className="h-full w-full rounded-2xl bg-[#1a0d14]" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-4">
        {/* Pink glow strip at top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF007A]/80 to-transparent" />

        <div className="flex items-start gap-3">
          {/* Icon container */}
          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#FF007A]/20 flex items-center justify-center mt-0.5">
            <Megaphone className="w-4 h-4 text-[#FF007A]" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-[#FF007A] bg-[#FF007A]/15 border border-[#FF007A]/30 px-2 py-0.5 rounded-full tracking-wider uppercase">
                중요
              </span>
              {isNew(notice) && (
                <span className="text-[10px] font-bold text-white bg-[#FF007A] px-2 py-0.5 rounded-full animate-pulse-live">
                  NEW
                </span>
              )}
            </div>
            <p className="font-bold text-white text-sm leading-snug mb-1.5">{notice.title}</p>
            <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">
              {notice.content}
            </p>
            <p className="text-[#FF007A]/60 text-xs mt-2.5 text-right">
              {formatRelativeDate(notice.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralCard({ notice }: { notice: Notice }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon container */}
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center mt-0.5">
          <Info className="w-4 h-4 text-white/50" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {isNew(notice) && (
              <span className="text-[10px] font-bold text-[#FF4D8D] bg-[#FF4D8D]/15 border border-[#FF4D8D]/25 px-2 py-0.5 rounded-full">
                NEW
              </span>
            )}
          </div>
          <p className="font-semibold text-white/90 text-sm leading-snug mb-1.5">{notice.title}</p>
          <p className="text-white/55 text-sm whitespace-pre-wrap leading-relaxed">
            {notice.content}
          </p>
          <p className="text-white/25 text-xs mt-2.5 text-right">
            {formatRelativeDate(notice.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function NoticeModal({ isOpen, onClose }: NoticeModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ['notices', 'active'],
    queryFn: getActiveNotices,
    staleTime: 60_000,
    enabled: isOpen,
  });

  if (!isOpen || !mounted) return null;

  const importantNotices = notices.filter((n) => n.category === 'IMPORTANT');
  const generalNotices = notices.filter((n) => n.category !== 'IMPORTANT');

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        role="dialog"
        id="notice-modal"
        tabIndex={-1}
        aria-modal="true"
        aria-label="공지사항"
        aria-labelledby="notice-modal-title"
        className="fixed inset-x-0 bottom-0 z-[60] bg-[#0f0a10] rounded-t-[28px] animate-slide-up-sheet max-h-[80dvh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg sm:rounded-3xl sm:bottom-6"
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 -2px 0 rgba(255,0,122,0.15)' }}
      >
        {/* Pink accent line at top edge */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-[#FF007A]/60 to-transparent rounded-full" />

        {/* Handle bar */}
        <div className="flex-shrink-0 flex justify-center pt-3.5 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5">
          <div>
            <h2 id="notice-modal-title" className="text-white font-bold text-base">
              공지사항
            </h2>
            {notices.length > 0 && (
              <p className="text-white/35 text-xs mt-0.5">{notices.length}개의 공지</p>
            )}
          </div>

          {/* Single prominent close button */}
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/12 border border-white/10 active:scale-95 transition-all"
            aria-label="공지사항 닫기"
          >
            <X className="w-4 h-4 text-white/80" strokeWidth={2.5} />
          </button>
        </div>

        {/* Divider */}
        <div className="flex-shrink-0 h-px mx-5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0 px-4 pt-4 pb-6 space-y-2.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#FF007A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <Inbox className="w-6 h-6 text-white/20" aria-hidden="true" />
              </div>
              <p className="text-white/35 text-sm">공지사항이 없습니다</p>
            </div>
          ) : (
            <>
              {/* Important notices first */}
              {importantNotices.map((notice) => (
                <ImportantCard key={notice.id} notice={notice} />
              ))}

              {/* Section divider if both types exist */}
              {importantNotices.length > 0 && generalNotices.length > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-white/25 text-[10px] font-medium tracking-wider uppercase">
                    일반
                  </span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>
              )}

              {/* General notices */}
              {generalNotices.map((notice) => (
                <GeneralCard key={notice.id} notice={notice} />
              ))}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
