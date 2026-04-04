'use client';

import { useQuery } from '@tanstack/react-query';
import { Megaphone, Inbox } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface NoticeData {
  text: string | null;
  fontSize: number;
  fontFamily: string;
}

const header = (
  <h3 className="text-lg font-semibold text-hot-pink flex items-center gap-2">
    <Megaphone className="w-5 h-5" aria-hidden="true" /> 공지
  </h3>
);

export function NoticeBox() {
  const { data: notice, isLoading } = useQuery<NoticeData>({
    queryKey: ['notice', 'current'],
    queryFn: async () => {
      const response = await apiClient.get<NoticeData>('/notices/current');
      return response.data;
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <aside className="notice-box bg-content-bg rounded-2xl p-6 h-full">
        <div className="mb-4">{header}</div>
        <p className="text-secondary-text text-sm">Loading...</p>
      </aside>
    );
  }

  return (
    <aside className="notice-box bg-content-bg rounded-2xl p-6 h-full flex flex-col">
      <div className="mb-4 flex-shrink-0">{header}</div>
      <div className="flex-1 overflow-y-auto">
        {notice?.text ? (
          <p
            className="whitespace-pre-wrap text-primary-text leading-relaxed"
            style={{ fontSize: `${notice.fontSize}px`, fontFamily: notice.fontFamily }}
          >
            {notice.text}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Inbox className="w-12 h-12 text-secondary-text/50 mb-3" aria-hidden="true" />
            <p className="text-secondary-text text-sm">현재 공지가 없습니다</p>
          </div>
        )}
      </div>
    </aside>
  );
}
