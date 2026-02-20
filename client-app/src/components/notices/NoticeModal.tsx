'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, AlertCircle, Sparkles, Inbox } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
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

type Tab = 'important' | 'new';

export function NoticeModal({ isOpen, onClose }: NoticeModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('important');

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ['notices', 'active'],
    queryFn: getActiveNotices,
    staleTime: 60_000,
    enabled: isOpen,
  });

  const importantNotices = notices.filter((n) => n.category === 'IMPORTANT');
  const newNotices = notices.filter(isNew);

  const displayedNotices = activeTab === 'important' ? importantNotices : newNotices;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="공지사항" maxWidth="md">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('important')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'important'
                ? 'border-hot-pink text-hot-pink'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            중요
            {importantNotices.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-hot-pink text-white text-[10px] font-bold">
                {importantNotices.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'new'
                ? 'border-hot-pink text-hot-pink'
                : 'border-transparent text-secondary-text hover:text-primary-text'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            NEW
            {newNotices.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-hot-pink text-white text-[10px] font-bold">
                {newNotices.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[240px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-hot-pink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayedNotices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Inbox className="w-10 h-10 text-secondary-text/40 mb-2" aria-hidden="true" />
              <p className="text-secondary-text text-sm">
                {activeTab === 'important'
                  ? '중요 공지가 없습니다'
                  : '최근 7일 이내 공지가 없습니다'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {displayedNotices.map((notice) => (
                <li
                  key={notice.id}
                  className="bg-content-bg border border-border-color rounded-button p-4"
                >
                  <div className="flex items-start gap-2">
                    {notice.category === 'IMPORTANT' && (
                      <AlertCircle
                        className="w-4 h-4 text-hot-pink flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary-text text-sm leading-snug">
                        {notice.title}
                      </p>
                      <p className="text-secondary-text text-sm mt-1 whitespace-pre-wrap leading-relaxed">
                        {notice.content}
                      </p>
                      <p className="text-secondary-text/60 text-xs mt-2 text-right">
                        {formatRelativeDate(notice.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
