'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface NoticeData {
  text: string | null;
  fontSize: number;
  fontFamily: string;
}

/**
 * NoticeBox Component
 * Displays the current system notice in a simple rectangular box
 * Used on the live streaming page sidebar (30% width on desktop)
 * Auto-refreshes every 15 seconds
 */
export function NoticeBox() {
  const { data: notice, isLoading } = useQuery<NoticeData>({
    queryKey: ['notice', 'current'],
    queryFn: async () => {
      const response = await apiClient.get<NoticeData>('/notices/current');
      return response.data;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  if (isLoading) {
    return (
      <aside className="notice-box bg-content-bg rounded-2xl p-6 h-full">
        <div className="notice-header mb-4">
          <h3 className="text-lg font-semibold text-hot-pink flex items-center gap-2">
            📢 공지
          </h3>
        </div>
        <div className="notice-content">
          <p className="text-secondary-text text-sm">Loading...</p>
        </div>
      </aside>
    );
  }

  const hasNotice = notice && notice.text;

  return (
    <aside className="notice-box bg-content-bg rounded-2xl p-6 h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="notice-header mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-hot-pink flex items-center gap-2">
          📢 공지
        </h3>
      </div>

      {/* Content - Scrollable if needed */}
      <div className="notice-content flex-1 overflow-y-auto">
        {hasNotice ? (
          <p
            className="whitespace-pre-wrap text-primary-text leading-relaxed"
            style={{
              fontSize: `${notice.fontSize}px`,
              fontFamily: notice.fontFamily,
            }}
          >
            {notice.text}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="text-5xl mb-3 opacity-50">📭</div>
            <p className="text-secondary-text text-sm">현재 공지가 없습니다</p>
          </div>
        )}
      </div>
    </aside>
  );
}
