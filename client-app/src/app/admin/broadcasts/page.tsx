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
  Upload,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
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
  thumbnailUrl: string | null;
  freeShippingEnabled: boolean;
  user?: { name: string; email: string };
}

interface LiveStatusResponse {
  isLive: boolean;
  streamId: string | null;
  title: string | null;
  duration: string | null;
  viewerCount: number;
  thumbnailUrl: string | null;
  startedAt: string | null;
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
  scheduledAt: string | null;
  thumbnailUrl: string | null;
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

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newStreamTitle, setNewStreamTitle] = useState('');
  const [newStreamScheduledAt, setNewStreamScheduledAt] = useState('');
  const [newStreamThumbnailUrl, setNewStreamThumbnailUrl] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newStreamFreeShipping, setNewStreamFreeShipping] = useState(false);
  const [generatedStream, setGeneratedStream] = useState<GeneratedStreamKey | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [selectedStreamForEdit, setSelectedStreamForEdit] = useState<LiveStream | null>(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const [editNewThumbnailUrl, setEditNewThumbnailUrl] = useState('');
  const [isUploadingEditThumbnail, setIsUploadingEditThumbnail] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFreeShipping, setEditFreeShipping] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [selectedStreamForFeatured, setSelectedStreamForFeatured] = useState<LiveStream | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/login');
      else if (user.role !== 'ADMIN') router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchLiveStatus = async () => {
      if (!user || user.role !== 'ADMIN') return;
      try {
        const response = await apiClient.get<LiveStatusResponse>('/streaming/live-status');
        setLiveStatus(response.data);
      } catch (err) {
        console.error('Failed to fetch live status:', err);
      }
    };
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || user.role !== 'ADMIN') return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<StreamHistoryResponse>('/streaming/history', {
          params: { page, limit: pageSize },
        });
        setStreams(response.data.streams);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } catch (err: any) {
        setError(err.message || '방송 기록을 불러오지 못했습니다');
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [user, page, pageSize]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
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
    const configs: Record<string, { label: string; className: string; Icon: any }> = {
      LIVE: { label: '방송중', className: 'bg-red-100 text-red-700 animate-pulse', Icon: Play },
      PENDING: { label: '대기', className: 'bg-amber-100 text-amber-700', Icon: Clock },
      OFFLINE: { label: '오프라인', className: 'bg-gray-100 text-gray-500', Icon: StopCircle },
    };
    const config = configs[status] || configs.OFFLINE;
    const Icon = config.Icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.className}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const handleCopyToClipboard = async (text: string, field: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      alert('복사에 실패했습니다. 직접 선택하여 복사해주세요.');
    }
  };

  const handleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setThumbnailPreview(previewUrl);
    setIsUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post<{ url: string }>('/upload/image', formData);
      setNewStreamThumbnailUrl(response.data.url);
    } catch (err: any) {
      setThumbnailPreview(null);
      URL.revokeObjectURL(previewUrl);
      setGenerateError(err.message || '썸네일 업로드에 실패했습니다.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleRemoveThumbnail = () => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
    setNewStreamThumbnailUrl('');
  };

  const handleCloseModal = () => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
    setShowGenerateModal(false);
    setGeneratedStream(null);
    setNewStreamTitle('');
    setNewStreamScheduledAt('');
    setNewStreamThumbnailUrl('');
    setNewStreamFreeShipping(false);
    setGenerateError(null);
  };

  const handleGenerateStreamKey = async () => {
    if (!newStreamTitle.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const body: Record<string, any> = { title: newStreamTitle.trim() };
      if (newStreamScheduledAt)
        body.scheduledAt = new Date(newStreamScheduledAt + '+09:00').toISOString();
      if (newStreamThumbnailUrl.trim()) body.thumbnailUrl = newStreamThumbnailUrl.trim();
      body.freeShippingEnabled = newStreamFreeShipping;
      const response = await apiClient.post<GeneratedStreamKey>('/streaming/generate-key', body);
      setGeneratedStream(response.data);
      setNewStreamTitle('');
      setNewStreamScheduledAt('');
      setNewStreamThumbnailUrl('');
    } catch (err: any) {
      setGenerateError(err.message || '스트림 키 발급에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenEditModal = (stream: LiveStream) => {
    setSelectedStreamForEdit(stream);
    setEditFreeShipping(stream.freeShippingEnabled ?? false);
    setEditThumbnailPreview(null);
    setEditNewThumbnailUrl('');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleCloseEditModal = () => {
    if (editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview);
    setSelectedStreamForEdit(null);
    setEditThumbnailPreview(null);
    setEditNewThumbnailUrl('');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleEditThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setEditThumbnailPreview(previewUrl);
    setIsUploadingEditThumbnail(true);
    setEditError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post<{ url: string }>('/upload/image', formData);
      setEditNewThumbnailUrl(response.data.url);
    } catch (err: any) {
      setEditThumbnailPreview(null);
      URL.revokeObjectURL(previewUrl);
      setEditError(err.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploadingEditThumbnail(false);
    }
  };

  const handleRemoveEditThumbnail = () => {
    if (editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview);
    setEditThumbnailPreview(null);
    setEditNewThumbnailUrl('');
  };

  const handleSaveEdit = async () => {
    if (!selectedStreamForEdit) return;
    setIsSavingEdit(true);
    setEditError(null);
    setEditSuccess(null);
    try {
      const body: Record<string, any> = { freeShippingEnabled: editFreeShipping };
      if (editNewThumbnailUrl) body.thumbnailUrl = editNewThumbnailUrl;
      await apiClient.patch(`/streaming/${selectedStreamForEdit.id}`, body);
      const updatedThumbnail = editNewThumbnailUrl || selectedStreamForEdit.thumbnailUrl;
      setStreams((prev) =>
        prev.map((s) =>
          s.id === selectedStreamForEdit.id
            ? { ...s, freeShippingEnabled: editFreeShipping, thumbnailUrl: updatedThumbnail }
            : s,
        ),
      );
      if (editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview);
      setEditThumbnailPreview(null);
      setEditNewThumbnailUrl('');
      setSelectedStreamForEdit((prev) =>
        prev
          ? { ...prev, freeShippingEnabled: editFreeShipping, thumbnailUrl: updatedThumbnail }
          : null,
      );
      setEditSuccess('저장되었습니다');
      setTimeout(() => setEditSuccess(null), 3000);
    } catch (err: any) {
      setEditError(err.message || '저장에 실패했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (authLoading || !user || user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF4D8D] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-7 h-7 text-[#FF4D8D]" />
            방송 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">실시간 방송 현황 및 기록을 관리하세요</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF4D8D] text-white rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors"
        >
          <Plus className="w-4 h-4" />새 방송 시작
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-red-50 rounded-lg">
              <Radio className="w-5 h-5 text-red-500" />
            </div>
            {liveStatus?.isLive && (
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{liveStatus?.isLive ? 1 : 0}</p>
          <p className="text-sm text-gray-500 mt-0.5">현재 라이브 중</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(liveStatus?.viewerCount ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">총 시청자</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-sm text-gray-500 mt-0.5">총 방송 기록</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Active Stream Banner */}
      {liveStatus?.isLive && liveStatus.streamId && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            현재 라이브 방송
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-800">{liveStatus.title || '라이브 방송'}</p>
              {liveStatus.duration && (
                <p className="text-sm text-gray-500 mt-0.5">방송 시간: {liveStatus.duration}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-blue-600">
                  <Eye className="w-4 h-4" />
                  <span className="font-semibold text-sm">{liveStatus.viewerCount}</span>
                </div>
                <p className="text-xs text-gray-400">시청자</p>
              </div>
              {(() => {
                const activeStream = streams.find((s) => s.id === liveStatus.streamId);
                if (activeStream) {
                  return (
                    <button
                      onClick={() => setSelectedStreamForFeatured(activeStream)}
                      className="px-3 py-1.5 bg-pink-50 text-[#FF4D8D] rounded-lg hover:bg-pink-100 transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <Star className="w-4 h-4" />
                      추천 상품
                    </button>
                  );
                }
                return null;
              })()}
              {getStatusBadge('LIVE')}
            </div>
          </div>
        </div>
      )}

      {/* ReStream Manager */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <ReStreamManager
          liveStreamId={liveStatus?.streamId || null}
          isLive={!!liveStatus?.isLive}
        />
      </div>

      {/* Stream History Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">방송 기록</h2>
          <span className="text-sm text-gray-400">총 {total}건</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-[#FF4D8D] animate-spin" />
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Radio className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500">방송 기록이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[
                      '제목',
                      'Stream Key',
                      '상태',
                      '시작 시간',
                      '종료 시간',
                      '방송 시간',
                      '최대 시청자',
                      '작업',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {streams.map((stream) => (
                    <tr key={stream.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-800">{stream.title}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 font-mono">
                            {stream.streamKey.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() =>
                              handleCopyToClipboard(stream.streamKey, `key-${stream.id}`)
                            }
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            {copiedField === `key-${stream.id}` ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getStatusBadge(stream.status)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">
                          {formatDate(stream.startedAt)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDate(stream.endedAt)}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {formatDuration(stream.totalDuration)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-blue-600">
                          <Eye className="w-4 h-4" />
                          {stream.peakViewers}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {stream.status === 'PENDING' && (
                            <button
                              onClick={() => handleOpenEditModal(stream)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              편집
                            </button>
                          )}
                          {stream.status === 'LIVE' && (
                            <button
                              onClick={() => setSelectedStreamForFeatured(stream)}
                              className="px-3 py-1.5 bg-pink-50 text-[#FF4D8D] rounded-lg hover:bg-pink-100 transition-colors text-xs font-medium flex items-center gap-1"
                            >
                              <Star className="w-3.5 h-3.5" />
                              추천 상품
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  전체 {total}건 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    다음
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {generatedStream ? '방송 설정 정보' : '새 방송 시작'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {!generatedStream ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      방송 제목 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newStreamTitle}
                      onChange={(e) => setNewStreamTitle(e.target.value)}
                      placeholder="예: 오늘의 라이브 방송"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      예약 시작 시간 (선택)
                    </label>
                    <input
                      type="datetime-local"
                      value={newStreamScheduledAt}
                      onChange={(e) => setNewStreamScheduledAt(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      썸네일 이미지 (선택)
                    </label>
                    {thumbnailPreview ? (
                      <div className="relative inline-block">
                        <img
                          src={thumbnailPreview}
                          alt="썸네일 미리보기"
                          className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={handleRemoveThumbnail}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        {isUploadingThumbnail ? (
                          <Loader2 className="w-6 h-6 text-[#FF4D8D] animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">클릭하여 이미지 업로드</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleThumbnailFileChange}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="freeShippingNew"
                      checked={newStreamFreeShipping}
                      onChange={(e) => setNewStreamFreeShipping(e.target.checked)}
                      className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
                    />
                    <label
                      htmlFor="freeShippingNew"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      이 방송 무료배송 적용
                    </label>
                  </div>

                  {generateError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-700">{generateError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleGenerateStreamKey}
                      disabled={isGenerating || !newStreamTitle.trim()}
                      className="flex-1 py-2.5 bg-[#FF4D8D] text-white rounded-lg text-sm font-medium hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isGenerating ? '생성 중...' : '스트림 키 발급'}
                    </button>
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    스트림 키가 발급되었습니다. 아래 정보를 OBS에 입력하세요.
                  </div>

                  {[
                    { label: 'RTMP URL', value: generatedStream.rtmpUrl, field: 'rtmp' },
                    { label: '스트림 키', value: generatedStream.streamKey, field: 'streamKey' },
                    { label: 'HLS URL', value: generatedStream.hlsUrl, field: 'hls' },
                  ].map(({ label, value, field }) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={value}
                          readOnly
                          className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-600"
                        />
                        <button
                          onClick={() => handleCopyToClipboard(value, field)}
                          className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {copiedField === field ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleCloseModal}
                    className="w-full py-2.5 bg-[#FF4D8D] text-white rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors mt-2"
                  >
                    확인
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Stream Modal */}
      {selectedStreamForEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">방송 편집</h2>
              <button
                onClick={handleCloseEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">방송 제목</p>
                <p className="text-base font-semibold text-gray-800">
                  {selectedStreamForEdit.title}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  썸네일 변경
                </label>
                {editThumbnailPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={editThumbnailPreview}
                      alt="미리보기"
                      className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={handleRemoveEditThumbnail}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : selectedStreamForEdit.thumbnailUrl ? (
                  <div className="space-y-2">
                    <img
                      src={selectedStreamForEdit.thumbnailUrl}
                      alt="현재 썸네일"
                      className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#FF4D8D] cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      변경
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleEditThumbnailFileChange}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    {isUploadingEditThumbnail ? (
                      <Loader2 className="w-5 h-5 text-[#FF4D8D] animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">이미지 업로드</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditThumbnailFileChange}
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editFreeShipping"
                  checked={editFreeShipping}
                  onChange={(e) => setEditFreeShipping(e.target.checked)}
                  className="w-4 h-4 text-[#FF4D8D] focus:ring-[#FF4D8D] border-gray-300 rounded"
                />
                <label htmlFor="editFreeShipping" className="text-sm text-gray-700 cursor-pointer">
                  무료배송 적용
                </label>
              </div>

              {editError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{editError}</p>
                </div>
              )}
              {editSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">{editSuccess}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 bg-[#FF4D8D] text-white rounded-lg text-sm font-medium hover:bg-pink-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isSavingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingEdit ? '저장 중...' : '저장하기'}
                </button>
                <button
                  onClick={handleCloseEditModal}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Featured Product Modal */}
      {selectedStreamForFeatured && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">추천 상품 관리</h2>
              <button
                onClick={() => setSelectedStreamForFeatured(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
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
