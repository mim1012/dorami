'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import {
  Radio,
  Eye,
  Clock,
  TrendingUp,
  Play,
  StopCircle,
  Plus,
  X,
  Copy,
  Check,
  Star,
} from 'lucide-react';
import FeaturedProductManager from '@/components/admin/broadcasts/FeaturedProductManager';
import ReStreamManager from '@/components/admin/broadcasts/ReStreamManager';

interface LiveStream {
  id: string;
  streamKey: string;
  userId: string;
  title: string;
  status: 'PENDING' | 'LIVE' | 'OFFLINE';
  startedAt: string | null;
  endedAt: string | null;
  totalDuration: number | null;
  peakViewers: number;
  expiresAt: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
}

interface LiveStatusResponse {
  currentLiveCount: number;
  totalViewers: number;
  activeStreams: LiveStream[];
}

interface StreamHistoryResponse {
  streams: LiveStream[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface GeneratedStreamKey {
  id: string;
  streamKey: string;
  title: string;
  rtmpUrl: string;
  hlsUrl: string;
  expiresAt: string;
}

export default function BroadcastsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [liveStatus, setLiveStatus] = useState<LiveStatusResponse | null>(null);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stream key generation modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newStreamTitle, setNewStreamTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStream, setGeneratedStream] = useState<GeneratedStreamKey | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Featured product modal state
  const [selectedStreamForFeatured, setSelectedStreamForFeatured] = useState<LiveStream | null>(
    null,
  );

  // [DEV] Auth check disabled for development
  // useEffect(() => {
  //   if (!authLoading) {
  //     if (!user) {
  //       router.push('/login');
  //     } else if (user.role !== 'ADMIN') {
  //       router.push('/');
  //     }
  //   }
  // }, [user, authLoading, router]);

  // Fetch live status
  useEffect(() => {
    const fetchLiveStatus = async () => {
      // [DEV] if (!user || user.role !== 'ADMIN') return;

      try {
        const response = await apiClient.get<LiveStatusResponse>('/streaming/live-status');
        setLiveStatus(response.data);
      } catch (err: any) {
        console.error('Failed to fetch live status:', err);
      }
    };

    fetchLiveStatus();

    // Refresh every 10 seconds
    const interval = setInterval(fetchLiveStatus, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch stream history
  useEffect(() => {
    const fetchHistory = async () => {
      // [DEV] if (!user || user.role !== 'ADMIN') return;

      setIsLoading(true);
      setError(null);

      try {
        const params = {
          page,
          limit: pageSize,
        };

        const response = await apiClient.get<StreamHistoryResponse>('/streaming/history', {
          params,
        });

        setStreams(response.data.streams);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } catch (err: any) {
        console.error('Failed to fetch stream history:', err);
        setError(err.response?.data?.message || 'Failed to load stream history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user, page, pageSize]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      LIVE: 'bg-error/10 text-error border-error animate-pulse',
      PENDING: 'bg-warning/10 text-warning border-warning',
      OFFLINE: 'bg-secondary-text/10 text-secondary-text border-secondary-text',
    };

    const icons = {
      LIVE: Play,
      PENDING: Clock,
      OFFLINE: StopCircle,
    };

    const labels: Record<string, string> = {
      LIVE: '방송중',
      PENDING: '대기',
      OFFLINE: '오프라인',
    };

    const color = colors[status as keyof typeof colors] || colors.OFFLINE;
    const Icon = icons[status as keyof typeof icons] || StopCircle;
    const label = labels[status] || status;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${color}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  };

  const handleGenerateStreamKey = async () => {
    if (!newStreamTitle.trim()) return;

    setIsGenerating(true);
    try {
      const response = await apiClient.post<GeneratedStreamKey>('/streaming/generate-key', {
        title: newStreamTitle.trim(),
      });
      setGeneratedStream(response.data);
      setNewStreamTitle('');
    } catch (err: any) {
      setError(err.response?.data?.message || '스트림 키 발급에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCloseModal = () => {
    setShowGenerateModal(false);
    setGeneratedStream(null);
    setNewStreamTitle('');
  };

  // [DEV] Auth check disabled for development
  // if (authLoading || (user && user?.role !== 'ADMIN')) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-secondary-text">Loading...</div>
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary-text mb-2">
            방송 관리 <span className="text-hot-pink">Broadcasts</span>
          </h1>
          <p className="text-sm md:text-base text-secondary-text">
            실시간 방송 현황 및 기록을 관리하세요.
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 transition-colors"
        >
          <Plus className="w-5 h-5" />새 방송 시작
        </button>
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-error/10 rounded-lg">
              <Radio className="w-6 h-6 text-error" />
            </div>
            {liveStatus && liveStatus.currentLiveCount > 0 && (
              <div className="w-3 h-3 rounded-full bg-error animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            )}
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-primary-text mb-1">
            {liveStatus?.currentLiveCount || 0}
          </h3>
          <p className="text-sm text-secondary-text">현재 라이브 중</p>
        </div>

        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Eye className="w-6 h-6 text-info" />
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-primary-text mb-1">
            {liveStatus?.totalViewers.toLocaleString() || 0}
          </h3>
          <p className="text-sm text-secondary-text">총 시청자</p>
        </div>

        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-primary-text mb-1">{total}</h3>
          <p className="text-sm text-secondary-text">총 방송 기록</p>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-card p-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Active Streams */}
      {liveStatus && liveStatus.activeStreams.length > 0 && (
        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <h2 className="text-xl font-bold text-primary-text mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
            현재 라이브 방송
          </h2>
          <div className="space-y-3">
            {liveStatus.activeStreams.map((stream) => (
              <div
                key={stream.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-hot-pink transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-primary-text mb-1">{stream.title}</h3>
                  <p className="text-sm text-secondary-text">Stream Key: {stream.streamKey}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-info">
                      <Eye className="w-4 h-4" />
                      <span className="font-semibold">{stream.peakViewers}</span>
                    </div>
                    <p className="text-xs text-secondary-text">시청자</p>
                  </div>
                  <button
                    onClick={() => setSelectedStreamForFeatured(stream)}
                    className="px-3 py-1.5 bg-hot-pink/10 text-hot-pink rounded-lg hover:bg-hot-pink/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                  >
                    <Star className="w-4 h-4" />
                    추천 상품
                  </button>
                  {getStatusBadge(stream.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ReStream Manager */}
      <div className="bg-content-bg border border-gray-200 rounded-card p-6">
        <ReStreamManager
          liveStreamId={liveStatus?.activeStreams?.[0]?.id || null}
          isLive={!!liveStatus?.activeStreams?.length}
        />
      </div>

      {/* Stream History Table */}
      <div className="bg-content-bg border border-gray-200 rounded-card overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-primary-text">방송 기록</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-secondary-text">Loading...</p>
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Radio className="w-12 h-12 text-secondary-text/30 mb-3" />
            <p className="text-secondary-text">방송 기록이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      제목
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      Stream Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      시작 시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      종료 시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      방송 시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                      최대 시청자
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {streams.map((stream) => (
                    <tr key={stream.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary-text">{stream.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-text font-mono">
                          {stream.streamKey}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(stream.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-text">
                          {formatDate(stream.startedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-text">
                          {formatDate(stream.endedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary-text">
                          {formatDuration(stream.totalDuration)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-info">
                          <Eye className="w-4 h-4" />
                          {stream.peakViewers}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-secondary-text">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{' '}
                  {total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-primary-text bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-primary-text bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generate Stream Key Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-primary-text">
                {generatedStream ? '방송 설정 정보' : '새 방송 시작'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-secondary-text" />
              </button>
            </div>

            <div className="p-6">
              {!generatedStream ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      방송 제목
                    </label>
                    <input
                      type="text"
                      value={newStreamTitle}
                      onChange={(e) => setNewStreamTitle(e.target.value)}
                      placeholder="예: 오늘의 라이브 방송"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleGenerateStreamKey}
                    disabled={!newStreamTitle.trim() || isGenerating}
                    className="w-full py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? '발급 중...' : '스트림 키 발급'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-success/10 border border-success rounded-lg">
                    <p className="text-success font-medium">스트림 키가 발급되었습니다!</p>
                    <p className="text-sm text-secondary-text mt-1">
                      아래 정보를 OBS에 입력하세요.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      방송 제목
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-primary-text">
                      {generatedStream.title}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      RTMP 서버 URL
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-primary-text truncate">
                        {generatedStream.rtmpUrl.replace(`/${generatedStream.streamKey}`, '')}
                      </div>
                      <button
                        onClick={() =>
                          handleCopyToClipboard(
                            generatedStream.rtmpUrl.replace(`/${generatedStream.streamKey}`, ''),
                            'rtmpUrl',
                          )
                        }
                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="복사"
                      >
                        {copiedField === 'rtmpUrl' ? (
                          <Check className="w-5 h-5 text-success" />
                        ) : (
                          <Copy className="w-5 h-5 text-secondary-text" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      스트림 키
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-primary-text truncate">
                        {generatedStream.streamKey}
                      </div>
                      <button
                        onClick={() =>
                          handleCopyToClipboard(generatedStream.streamKey, 'streamKey')
                        }
                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="복사"
                      >
                        {copiedField === 'streamKey' ? (
                          <Check className="w-5 h-5 text-success" />
                        ) : (
                          <Copy className="w-5 h-5 text-secondary-text" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      시청 URL (HLS)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-primary-text truncate">
                        {generatedStream.hlsUrl}
                      </div>
                      <button
                        onClick={() => handleCopyToClipboard(generatedStream.hlsUrl, 'hlsUrl')}
                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="복사"
                      >
                        {copiedField === 'hlsUrl' ? (
                          <Check className="w-5 h-5 text-success" />
                        ) : (
                          <Copy className="w-5 h-5 text-secondary-text" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-warning/10 border border-warning rounded-lg">
                    <p className="text-warning font-medium text-sm">유효 기간</p>
                    <p className="text-sm text-secondary-text mt-1">
                      {formatDate(generatedStream.expiresAt)}까지 유효합니다.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseModal}
                      className="flex-1 py-3 bg-gray-100 text-primary-text rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      닫기
                    </button>
                    <button
                      onClick={() => setGeneratedStream(null)}
                      className="flex-1 py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 transition-colors"
                    >
                      새 키 발급
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Featured Product Management Modal */}
      {selectedStreamForFeatured && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-primary-text">추천 상품 관리</h2>
              <button
                onClick={() => setSelectedStreamForFeatured(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-secondary-text" />
              </button>
            </div>
            <div className="p-6">
              <FeaturedProductManager
                streamKey={selectedStreamForFeatured.streamKey}
                streamTitle={selectedStreamForFeatured.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
