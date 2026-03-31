'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import {
  Radio,
  Eye,
  Clock,
  TrendingUp,
  Play,
  KeyRound,
  StopCircle,
  Plus,
  X,
  Copy,
  Check,
  Star,
  Upload,
  Trash2,
  Pencil,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import FeaturedProductManager from '@/components/admin/broadcasts/FeaturedProductManager';
import ReStreamManager from '@/components/admin/broadcasts/ReStreamManager';
import {
  createReStreamTarget,
  getReStreamTargets,
  deleteReStreamTarget,
  deleteReStreamTargets,
  type ReStreamTarget,
  type ReStreamPlatform,
} from '@/lib/api/restream';
import { deleteStreamHistory } from '@/lib/api/streaming';

interface LiveStream {
  id: string;
  streamKey: string;
  userId: string;
  title: string;
  status: 'PENDING' | 'LIVE' | 'OFFLINE';
  scheduledAt?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  totalDuration: number | null;
  peakViewers: number;
  expiresAt: string;
  createdAt: string;
  thumbnailUrl: string | null;
  freeShippingMode: string;
  freeShippingThreshold?: number | null;
  user?: {
    name: string;
    email: string;
  };
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
  rtmpPort?: number;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  expiresAt: string;
}

type HistoryStatusFilter = 'ALL' | 'LIVE' | 'PENDING' | 'OFFLINE';

const HISTORY_FILTER_OPTIONS: { value: HistoryStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'LIVE', label: '방송중' },
  { value: 'PENDING', label: '예정' },
  { value: 'OFFLINE', label: '종료' },
];

const HISTORY_GROUP_ORDER: Record<string, number> = {
  today: 0,
  yesterday: 1,
  recent7: 2,
  recent30: 3,
  older: 4,
  unknown: 5,
};

const HISTORY_GROUP_NAMES: Record<string, string> = {
  today: '오늘',
  yesterday: '어제',
  recent7: '최근 7일',
  recent30: '최근 30일',
  older: '이전',
  unknown: '기록 없음',
};

const HISTORY_GROUP_PREVIEW_LIMIT = 2;

function getHistoryDateGroup(stream: LiveStream) {
  const source = stream.startedAt || stream.endedAt || stream.createdAt;
  const target = source ? new Date(source) : null;
  if (!target || Number.isNaN(target.getTime())) {
    return { key: 'unknown', label: HISTORY_GROUP_NAMES.unknown };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const daysAgo = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysAgo === 0) return { key: 'today', label: HISTORY_GROUP_NAMES.today };
  if (daysAgo === 1) return { key: 'yesterday', label: HISTORY_GROUP_NAMES.yesterday };
  if (daysAgo <= 7) return { key: 'recent7', label: HISTORY_GROUP_NAMES.recent7 };
  if (daysAgo <= 30) return { key: 'recent30', label: HISTORY_GROUP_NAMES.recent30 };
  return { key: 'older', label: HISTORY_GROUP_NAMES.older };
}

function getHistorySummary(stream: LiveStream) {
  const statusText =
    stream.status === 'LIVE' ? '방송중' : stream.status === 'PENDING' ? '예정' : '종료';
  const statusTone =
    stream.status === 'LIVE'
      ? 'bg-error/10 text-error border-error'
      : stream.status === 'PENDING'
        ? 'bg-warning/10 text-warning border-warning'
        : 'bg-secondary-text/10 text-secondary-text border-secondary-text';

  const durationText = stream.totalDuration
    ? `${Math.floor(stream.totalDuration / 3600)}h ${Math.floor((stream.totalDuration % 3600) / 60)}m`
    : '-';

  return { statusText, statusTone, durationText };
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
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [isBulkDeletingHistory, setIsBulkDeletingHistory] = useState(false);

  // Stream key generation modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [newStreamTitle, setNewStreamTitle] = useState('');
  const [newStreamDescription, setNewStreamDescription] = useState('');
  const [newStreamScheduledAt, setNewStreamScheduledAt] = useState('');
  const [newStreamThumbnailUrl, setNewStreamThumbnailUrl] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newStreamFreeShippingMode, setNewStreamFreeShippingMode] = useState('DISABLED');
  const [newStreamFreeShippingThreshold, setNewStreamFreeShippingThreshold] = useState(150);
  const [generatedStream, setGeneratedStream] = useState<GeneratedStreamKey | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Step 3: Restream targets state
  const [restreamTargets, setRestreamTargets] = useState<ReStreamTarget[]>([]);
  const [isLoadingRestream, setIsLoadingRestream] = useState(false);
  const [restreamError, setRestreamError] = useState<string | null>(null);
  const [newRestreamPlatform, setNewRestreamPlatform] = useState<ReStreamPlatform>('YOUTUBE');
  const [newRestreamName, setNewRestreamName] = useState('');
  const [newRestreamRtmpUrl, setNewRestreamRtmpUrl] = useState('rtmp://a.rtmp.youtube.com/live2/');
  const [newRestreamKey, setNewRestreamKey] = useState('');
  const [newRestreamMuteAudio, setNewRestreamMuteAudio] = useState(false);
  const [isAddingRestream, setIsAddingRestream] = useState(false);
  const [selectedRestreamTargetIds, setSelectedRestreamTargetIds] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkDeletingRestreamTargets, setIsBulkDeletingRestreamTargets] = useState(false);

  const PLATFORM_RTMP_URLS: Record<ReStreamPlatform, string> = {
    YOUTUBE: 'rtmp://a.rtmp.youtube.com/live2/',
    INSTAGRAM: 'rtmps://live-upload.instagram.com:443/rtmp/',
    TIKTOK: 'rtmp://push.rtmp.tiktok.com/live/',
    CUSTOM: '',
  };

  const PLATFORM_LABELS: Record<ReStreamPlatform, string> = {
    YOUTUBE: 'YouTube',
    INSTAGRAM: 'Instagram',
    TIKTOK: 'TikTok',
    CUSTOM: 'Custom',
  };

  // Edit stream modal state
  const [selectedStreamForEdit, setSelectedStreamForEdit] = useState<LiveStream | null>(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const [editNewThumbnailUrl, setEditNewThumbnailUrl] = useState('');
  const [isUploadingEditThumbnail, setIsUploadingEditThumbnail] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFreeShippingMode, setEditFreeShippingMode] = useState('DISABLED');
  const [editFreeShippingThreshold, setEditFreeShippingThreshold] = useState(150);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Featured product modal state
  const [selectedStreamForFeatured, setSelectedStreamForFeatured] = useState<LiveStream | null>(
    null,
  );
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('ALL');
  const [historyOnlyWithIssue, setHistoryOnlyWithIssue] = useState(false);
  const [expandedHistoryGroups, setExpandedHistoryGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  // Fetch live status
  useEffect(() => {
    const fetchLiveStatus = async () => {
      if (!user || user.role !== 'ADMIN') return;

      try {
        const response = await apiClient.get<LiveStatusResponse>('/streaming/live-status');
        setLiveStatus(response.data);
      } catch (err: any) {
        console.error('Failed to fetch live status:', err);
      }
    };

    fetchLiveStatus();

    // Refresh every 10 seconds
    const interval = setInterval(fetchLiveStatus, 10000); // 관리자는 이미 10초
    return () => clearInterval(interval);
  }, [user]);

  const fetchHistory = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return;

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
      setSelectedHistoryIds(new Set());
    } catch (err: any) {
      console.error('Failed to fetch stream history:', err);
      setError(err.message || 'Failed to load stream history');
    } finally {
      setIsLoading(false);
    }
  }, [user, page, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
    setExpandedHistoryGroups(new Set());
    setSelectedHistoryIds(new Set());
  }, [historyKeyword, historyStatusFilter, historyOnlyWithIssue]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTimeInput = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const filteredHistoryStreams = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();
    const base = streams.filter((stream) => {
      if (historyStatusFilter !== 'ALL' && stream.status !== historyStatusFilter) {
        return false;
      }

      if (!keyword) return true;

      return (
        stream.title.toLowerCase().includes(keyword) ||
        stream.streamKey.toLowerCase().includes(keyword) ||
        stream.user?.name.toLowerCase().includes(keyword) ||
        stream.user?.email.toLowerCase().includes(keyword)
      );
    });

    if (!historyOnlyWithIssue) {
      return base;
    }

    return base.filter(
      (stream) =>
        stream.status !== 'LIVE' || stream.totalDuration === 0 || stream.peakViewers === 0,
    );
  }, [streams, historyKeyword, historyStatusFilter, historyOnlyWithIssue]);

  const groupedHistoryStreams = useMemo(() => {
    const groups = new Map<string, LiveStream[]>();

    filteredHistoryStreams.forEach((stream) => {
      const { key } = getHistoryDateGroup(stream);
      const list = groups.get(key);
      if (list) list.push(stream);
      else groups.set(key, [stream]);
    });

    return Array.from(groups.entries())
      .map(([groupKey, list]) => ({
        key: groupKey,
        label: HISTORY_GROUP_NAMES[groupKey],
        streams: list.slice().sort((a, b) => {
          const aRef = new Date(a.startedAt || a.createdAt).getTime();
          const bRef = new Date(b.startedAt || b.createdAt).getTime();
          return bRef - aRef;
        }),
      }))
      .sort((a, b) => (HISTORY_GROUP_ORDER[a.key] ?? 99) - (HISTORY_GROUP_ORDER[b.key] ?? 99));
  }, [filteredHistoryStreams]);

  const selectableHistoryIds = useMemo(
    () =>
      filteredHistoryStreams
        .filter((stream) => stream.status !== 'LIVE')
        .map((stream) => stream.id),
    [filteredHistoryStreams],
  );

  const isAllHistorySelectableSelected = useMemo(
    () =>
      selectableHistoryIds.length > 0 &&
      selectableHistoryIds.every((streamId) => selectedHistoryIds.has(streamId)),
    [selectableHistoryIds, selectedHistoryIds],
  );

  const selectedHistoryCount = selectedHistoryIds.size;

  const selectableRestreamTargetIds = useMemo(
    () => restreamTargets.map((target) => target.id),
    [restreamTargets],
  );

  const isAllRestreamTargetsSelected = useMemo(
    () =>
      selectableRestreamTargetIds.length > 0 &&
      selectableRestreamTargetIds.every((targetId) => selectedRestreamTargetIds.has(targetId)),
    [selectableRestreamTargetIds, selectedRestreamTargetIds],
  );

  const selectedRestreamTargetCount = selectedRestreamTargetIds.size;

  useEffect(() => {
    setSelectedHistoryIds((prev) => {
      const validIds = new Set(selectableHistoryIds);
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [selectableHistoryIds]);

  const toggleHistorySelection = (streamId: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedRestreamTargetIds((prev) => {
      const validIds = new Set(selectableRestreamTargetIds);
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [selectableRestreamTargetIds]);

  const toggleRestreamTargetSelection = (targetId: string) => {
    setSelectedRestreamTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  };

  const toggleSelectAllRestreamTargets = () => {
    if (isAllRestreamTargetsSelected) {
      setSelectedRestreamTargetIds(new Set());
      return;
    }
    setSelectedRestreamTargetIds(new Set(selectableRestreamTargetIds));
  };

  const toggleSelectAllHistory = () => {
    if (isAllHistorySelectableSelected) {
      setSelectedHistoryIds(new Set());
      return;
    }
    setSelectedHistoryIds(new Set(selectableHistoryIds));
  };

  const toggleHistoryGroupExpand = (groupKey: string) => {
    setExpandedHistoryGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
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

  const [generateError, setGenerateError] = useState<string | null>(null);

  const getRtmpUrlWithPort = (url: string) => {
    const match = url.match(/^(rtmp:\/\/[^/]+)(\/.*)?$/);
    if (!match) return url;
    const [, host, path] = match;
    const hasPort = /:\d+$/.test(host);
    if (hasPort) return url;
    return `${host}:1935${path || ''}`;
  };

  const handleGenerateStreamKey = async () => {
    if (!newStreamTitle.trim()) return;

    setIsGenerating(true);
    setGenerateError(null);
    try {
      const body: Record<string, any> = { title: newStreamTitle.trim() };
      if (newStreamDescription.trim()) body.description = newStreamDescription.trim();
      if (newStreamScheduledAt)
        body.scheduledAt = new Date(newStreamScheduledAt + '+09:00').toISOString();
      if (newStreamThumbnailUrl.trim()) body.thumbnailUrl = newStreamThumbnailUrl.trim();
      body.freeShippingMode = newStreamFreeShippingMode;
      if (newStreamFreeShippingMode === 'THRESHOLD') {
        body.freeShippingThreshold = newStreamFreeShippingThreshold;
      }
      const response = await apiClient.post<GeneratedStreamKey>('/streaming/generate-key', body);
      setGeneratedStream(response.data);
      setNewStreamTitle('');
      setNewStreamDescription('');
      setNewStreamScheduledAt('');
      setNewStreamThumbnailUrl('');
      setModalStep(2);
    } catch (err: any) {
      const message = err.message || '스트림 키 발급에 실패했습니다.';
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadRestreamTargets = async () => {
    setIsLoadingRestream(true);
    setRestreamError(null);
    try {
      const data = await getReStreamTargets();
      setRestreamTargets(data);
    } catch (err: any) {
      setRestreamError(err.message || '동시송출 대상을 불러올 수 없습니다.');
    } finally {
      setIsLoadingRestream(false);
    }
  };

  const handleRestreamPlatformChange = (platform: ReStreamPlatform) => {
    setNewRestreamPlatform(platform);
    const url = PLATFORM_RTMP_URLS[platform];
    if (url) setNewRestreamRtmpUrl(url);
    if (platform === 'INSTAGRAM') setNewRestreamMuteAudio(true);
  };

  const handleAddRestreamTarget = async () => {
    if (!newRestreamName.trim() || !newRestreamRtmpUrl.trim() || !newRestreamKey.trim()) {
      setRestreamError('필수 정보를 입력해주세요.');
      return;
    }

    setIsAddingRestream(true);
    setRestreamError(null);
    try {
      const newTarget = await createReStreamTarget({
        platform: newRestreamPlatform,
        name: newRestreamName.trim(),
        rtmpUrl: newRestreamRtmpUrl.trim(),
        streamKey: newRestreamKey.trim(),
        enabled: true,
        muteAudio: newRestreamMuteAudio,
      });
      setRestreamTargets((prev) => [...prev, newTarget]);
      setNewRestreamName('');
      setNewRestreamKey('');
      setNewRestreamRtmpUrl(PLATFORM_RTMP_URLS.YOUTUBE);
      setNewRestreamPlatform('YOUTUBE');
      setNewRestreamMuteAudio(false);
    } catch (err: any) {
      setRestreamError(err.message || '동시송출 대상 추가에 실패했습니다.');
    } finally {
      setIsAddingRestream(false);
    }
  };

  const handleDeleteRestreamTarget = async (id: string) => {
    if (!confirm('이 동시 송출 대상을 삭제하시겠습니까?')) return;
    try {
      await deleteReStreamTarget(id);
      setRestreamTargets((prev) => prev.filter((t) => t.id !== id));
      setSelectedRestreamTargetIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      setRestreamError(err.message || '삭제에 실패했습니다.');
    }
  };

  const handleBulkDeleteRestreamTargets = async () => {
    const ids = Array.from(selectedRestreamTargetIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 동시 송출 대상 ${ids.length}개를 삭제하시겠습니까?`)) return;

    setIsBulkDeletingRestreamTargets(true);
    try {
      await deleteReStreamTargets(ids);
      await loadRestreamTargets();
      setSelectedRestreamTargetIds(new Set());
    } catch (err: any) {
      setRestreamError(err.message || '일괄 삭제에 실패했습니다.');
    } finally {
      setIsBulkDeletingRestreamTargets(false);
    }
  };

  const handleBulkDeleteHistory = async () => {
    if (selectedHistoryIds.size === 0) return;
    if (!confirm(`선택한 방송 기록 ${selectedHistoryIds.size}개를 삭제하시겠습니까?`)) return;

    setIsBulkDeletingHistory(true);
    try {
      const result = await deleteStreamHistory(Array.from(selectedHistoryIds));
      await fetchHistory();

      const skippedCount = result.skippedCount ?? 0;
      if (skippedCount > 0) {
        const skippedText = `선택 ${selectedHistoryIds.size}개 중 ${result.deletedCount}개 삭제, ${skippedCount}개는 건너뜀`;
        setError(skippedText);
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || '방송 기록 일괄 삭제에 실패했습니다.');
    } finally {
      setIsBulkDeletingHistory(false);
    }
  };

  const handleDeleteHistory = async (streamId: string) => {
    if (!confirm('이 방송 기록을 삭제하시겠습니까?')) return;

    try {
      const result = await deleteStreamHistory([streamId]);
      await fetchHistory();
      if (result.deletedCount === 0 && result.skippedCount > 0) {
        setError('이 방송은 현재 삭제할 수 없습니다.');
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || '방송 기록 삭제에 실패했습니다.');
    }
  };

  const handleCopyToClipboard = async (text: string, field: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for HTTP / non-secure context
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
    } catch (err) {
      console.error('Failed to copy:', err);
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
      const response = await apiClient.post<{ url: string }>('/upload/thumbnail', formData);
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
    setNewStreamFreeShippingMode('DISABLED');
    setNewStreamFreeShippingThreshold(150);
    setGenerateError(null);
    setModalStep(1);
    setRestreamTargets([]);
    setNewRestreamName('');
    setNewRestreamKey('');
    setNewRestreamRtmpUrl(PLATFORM_RTMP_URLS.YOUTUBE);
    setNewRestreamPlatform('YOUTUBE');
    setNewRestreamMuteAudio(false);
    setRestreamError(null);
    setSelectedRestreamTargetIds(new Set());
  };

  const handleOpenGenerateModal = (stream?: LiveStream) => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
    setGeneratedStream(null);
    setGenerateError(null);
    setModalStep(1);
    setRestreamTargets([]);
    setNewRestreamName('');
    setNewRestreamKey('');
    setNewRestreamRtmpUrl(PLATFORM_RTMP_URLS.YOUTUBE);
    setNewRestreamPlatform('YOUTUBE');
    setNewRestreamMuteAudio(false);
    setRestreamError(null);
    setSelectedRestreamTargetIds(new Set());
    if (stream) {
      setNewStreamTitle(stream.title || '');
      setNewStreamScheduledAt(formatDateTimeInput(stream.scheduledAt || null));
      setNewStreamThumbnailUrl(stream.thumbnailUrl || '');
      setNewStreamFreeShippingMode(stream.freeShippingMode ?? 'DISABLED');
      setNewStreamFreeShippingThreshold(stream.freeShippingThreshold ?? 150);
    } else {
      setNewStreamTitle('');
      setNewStreamScheduledAt('');
      setNewStreamThumbnailUrl('');
      setNewStreamFreeShippingMode('DISABLED');
      setNewStreamFreeShippingThreshold(150);
    }
    setShowGenerateModal(true);
  };

  const handleOpenEditModal = (stream: LiveStream) => {
    setSelectedStreamForEdit(stream);
    setEditFreeShippingMode(stream.freeShippingMode ?? 'DISABLED');
    setEditFreeShippingThreshold(stream.freeShippingThreshold ?? 150);
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
      const response = await apiClient.post<{ url: string }>('/upload/thumbnail', formData);
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
      const body: Record<string, any> = {
        freeShippingMode: editFreeShippingMode,
        ...(editFreeShippingMode === 'THRESHOLD'
          ? { freeShippingThreshold: editFreeShippingThreshold }
          : {}),
      };
      if (editNewThumbnailUrl) body.thumbnailUrl = editNewThumbnailUrl;
      await apiClient.patch(`/streaming/${selectedStreamForEdit.id}`, body);
      const updatedThumbnail = editNewThumbnailUrl || selectedStreamForEdit.thumbnailUrl;
      setStreams((prev) =>
        prev.map((s) =>
          s.id === selectedStreamForEdit.id
            ? {
                ...s,
                freeShippingMode: editFreeShippingMode,
                freeShippingThreshold:
                  editFreeShippingMode === 'THRESHOLD' ? editFreeShippingThreshold : null,
                thumbnailUrl: updatedThumbnail,
              }
            : s,
        ),
      );
      if (editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview);
      setEditThumbnailPreview(null);
      setEditNewThumbnailUrl('');
      setSelectedStreamForEdit((prev) =>
        prev
          ? {
              ...prev,
              freeShippingMode: editFreeShippingMode,
              freeShippingThreshold:
                editFreeShippingMode === 'THRESHOLD' ? editFreeShippingThreshold : null,
              thumbnailUrl: updatedThumbnail,
            }
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
      <div className="flex items-center justify-center py-24">
        <div className="text-secondary-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-primary-text mb-2">
            방송 관리 <span className="text-hot-pink">Broadcasts</span>
          </h1>
          <p className="text-sm md:text-base text-secondary-text">
            실시간 방송 현황 및 기록을 관리하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end md:shrink-0 min-w-0">
          <button
            onClick={() => handleOpenGenerateModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 transition-colors shrink-0 whitespace-nowrap"
          >
            <KeyRound className="w-5 h-5" />
            방송 키 발급
          </button>
          <button
            onClick={() => handleOpenGenerateModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-hot-pink/30 text-hot-pink rounded-lg font-medium hover:bg-hot-pink/5 transition-colors shrink-0 whitespace-nowrap"
          >
            <Play className="w-5 h-5" />
            방송 설정
          </button>
        </div>
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-error/10 rounded-lg">
              <Radio className="w-6 h-6 text-error" />
            </div>
            {liveStatus && liveStatus.isLive && (
              <div className="w-3 h-3 rounded-full bg-error animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            )}
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-primary-text mb-1">
            {liveStatus?.isLive ? 1 : 0}
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
            {(liveStatus?.viewerCount ?? 0).toLocaleString()}
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

      {/* Active Stream */}
      {liveStatus && liveStatus.isLive && liveStatus.streamId && (
        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <h2 className="text-xl font-bold text-primary-text mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
            현재 라이브 방송
          </h2>
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-hot-pink transition-colors">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-primary-text mb-1">
                  {liveStatus.title || '라이브 방송'}
                </h3>
                {liveStatus.duration && (
                  <p className="text-sm text-secondary-text">방송 시간: {liveStatus.duration}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end shrink-0">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-info">
                    <Eye className="w-4 h-4" />
                    <span className="font-semibold">{liveStatus.viewerCount}</span>
                  </div>
                  <p className="text-xs text-secondary-text">시청자</p>
                </div>
                {(() => {
                  const activeStream = streams.find((s) => s.id === liveStatus.streamId);
                  if (activeStream) {
                    return (
                      <button
                        onClick={() => setSelectedStreamForFeatured(activeStream)}
                        className="px-3 py-1.5 bg-hot-pink/10 text-hot-pink rounded-lg hover:bg-hot-pink/20 transition-colors text-sm font-medium flex items-center gap-1.5"
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
        </div>
      )}

      {/* ReStream Manager */}
      <div className="bg-content-bg border border-gray-200 rounded-card p-6">
        <ReStreamManager
          liveStreamId={liveStatus?.streamId || null}
          isLive={!!liveStatus?.isLive}
        />
      </div>

      {/* Stream History (Mobile-optimized Card List) */}
      <div className="bg-content-bg border border-gray-200 rounded-card overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-primary-text">방송 기록</h2>
          <p className="text-xs text-secondary-text mt-1">
            상태/키워드로 먼저 걸러내고, 기간별로 그룹해 긴 목록도 빠르게 탐색하세요.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={toggleSelectAllHistory}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-secondary-text hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={selectableHistoryIds.length === 0}
              >
                {isAllHistorySelectableSelected ? '전체 해제' : '전체 선택'}
              </button>
              <button
                onClick={handleBulkDeleteHistory}
                disabled={selectedHistoryCount === 0 || isBulkDeletingHistory}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-black/5 text-black border border-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkDeletingHistory ? '삭제 중...' : `일괄 삭제 (${selectedHistoryCount})`}
              </button>
              <span className="ml-auto text-xs text-secondary-text">
                선택 {selectedHistoryCount}개
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {HISTORY_FILTER_OPTIONS.map((option) => {
                const active = historyStatusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setHistoryStatusFilter(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? 'border-hot-pink bg-hot-pink/10 text-hot-pink'
                        : 'border-gray-200 text-secondary-text hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <label className="text-xs text-secondary-text mr-1 md:whitespace-nowrap">검색</label>
              <input
                type="text"
                value={historyKeyword}
                onChange={(e) => setHistoryKeyword(e.target.value)}
                placeholder="제목, Stream Key, 방송자"
                className="w-full md:flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none"
              />
              <label className="inline-flex items-center gap-2 text-xs text-secondary-text">
                <input
                  type="checkbox"
                  checked={historyOnlyWithIssue}
                  onChange={(e) => setHistoryOnlyWithIssue(e.target.checked)}
                  className="rounded border-gray-300"
                />
                이슈 의심(방송시간/시청자 0)
              </label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-secondary-text">Loading...</p>
          </div>
        ) : groupedHistoryStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Radio className="w-12 h-12 text-secondary-text/30 mb-3" />
            <p className="text-secondary-text">방송 기록이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-6 p-4 md:p-6">
              {groupedHistoryStreams.map((group) => {
                const isExpanded = expandedHistoryGroups.has(group.key);
                const visibleStreams = isExpanded
                  ? group.streams
                  : group.streams.slice(0, HISTORY_GROUP_PREVIEW_LIMIT);
                const canExpand = group.streams.length > HISTORY_GROUP_PREVIEW_LIMIT;

                return (
                  <section key={group.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-primary-text">{group.label}</h3>
                        <p className="text-xs text-secondary-text">{group.streams.length}건</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {visibleStreams.map((stream) => {
                        const summary = getHistorySummary(stream);
                        return (
                          <article
                            key={stream.id}
                            className="border border-gray-200 rounded-xl bg-white p-4 md:p-5 space-y-3"
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedHistoryIds.has(stream.id)}
                                disabled={stream.status === 'LIVE'}
                                onChange={() => toggleHistorySelection(stream.id)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-hot-pink focus:ring-hot-pink shrink-0"
                              />
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-primary-text truncate">
                                      {stream.title}
                                    </p>
                                    <p className="text-xs text-secondary-text mt-1">
                                      {stream.user?.name || '방송자 미설정'}
                                    </p>
                                  </div>
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${summary.statusTone}`}
                                  >
                                    {summary.statusText}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-secondary-text">시작</p>
                                <p className="text-primary-text">{formatDate(stream.startedAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-secondary-text">종료</p>
                                <p className="text-primary-text">{formatDate(stream.endedAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-secondary-text">방송 시간</p>
                                <p className="text-primary-text">{summary.durationText}</p>
                              </div>
                              <div>
                                <p className="text-xs text-secondary-text">최대 시청자</p>
                                <p className="text-primary-text flex items-center gap-1">
                                  <Eye className="w-4 h-4" />
                                  {stream.peakViewers}
                                </p>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-secondary-text mb-1">
                                Stream Key
                              </label>
                              <div className="flex items-start gap-2">
                                <p className="text-sm text-primary-text font-mono break-all flex-1">
                                  {stream.streamKey}
                                </p>
                                <button
                                  onClick={() =>
                                    handleCopyToClipboard(stream.streamKey, `key-${stream.id}`)
                                  }
                                  className="p-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors shrink-0"
                                  title="스트림 키 복사"
                                >
                                  {copiedField === `key-${stream.id}` ? (
                                    <Check className="w-4 h-4 text-success" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-secondary-text" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleOpenGenerateModal(stream)}
                                className="px-3 py-1.5 bg-hot-pink text-white rounded-lg hover:bg-hot-pink/90 transition-colors text-sm font-medium flex items-center gap-1.5"
                              >
                                <KeyRound className="w-4 h-4" />
                                방송 키 발급
                              </button>
                              <button
                                onClick={() => setSelectedStreamForFeatured(stream)}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-primary-text rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-1.5"
                              >
                                <Star className="w-4 h-4" />
                                추천상품
                              </button>
                              {stream.status === 'PENDING' && (
                                <button
                                  onClick={() => handleOpenEditModal(stream)}
                                  className="px-3 py-1.5 bg-info/10 text-info rounded-lg hover:bg-info/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                                >
                                  <Pencil className="w-4 h-4" />
                                  편집
                                </button>
                              )}
                              {stream.status !== 'LIVE' ? (
                                <button
                                  onClick={() => handleDeleteHistory(stream.id)}
                                  className="px-3 py-1.5 bg-white border border-gray-200 text-error rounded-lg hover:bg-error/5 transition-colors text-sm font-medium flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  삭제
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {canExpand ? (
                      <div className="pt-1">
                        <button
                          onClick={() => toggleHistoryGroupExpand(group.key)}
                          className="w-full rounded-lg border border-hot-pink/30 text-hot-pink bg-hot-pink/5 hover:bg-hot-pink/10 px-3 py-2 text-sm font-medium transition-colors"
                        >
                          <span className="inline-flex items-center justify-center gap-1.5">
                            {isExpanded
                              ? '기록 접기'
                              : `기록 더보기 (${group.streams.length - HISTORY_GROUP_PREVIEW_LIMIT}개 더 보기)`}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-secondary-text">
                  전체 {total}건 중 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-primary-text bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-primary-text bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generate Stream Key Modal - 3 Steps */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header with step indicator */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-primary-text mb-2">
                  {modalStep === 1 && '방송 시작하기'}
                  {modalStep === 2 && '스트림 키 발급 완료'}
                  {modalStep === 3 && '동시송출 설정'}
                </h2>
                <p className="text-xs text-secondary-text">Step {modalStep}/3</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-secondary-text" />
              </button>
            </div>

            <div className="p-6">
              {/* Step 1: Broadcast Info */}
              {modalStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      방송 제목 <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={newStreamTitle}
                      onChange={(e) => setNewStreamTitle(e.target.value)}
                      placeholder="예: 오늘의 라이브 방송"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      방송 상세내용{' '}
                      <span className="text-secondary-text text-xs">
                        (선택 · 알림톡 상세내용 변수)
                      </span>
                    </label>
                    <textarea
                      value={newStreamDescription}
                      onChange={(e) => setNewStreamDescription(e.target.value)}
                      placeholder="예: 오늘 방송에서는 신상 니트, 가디건을 소개합니다."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      방송 예정일{' '}
                      <span className="text-secondary-text text-xs">
                        (선택 · KST 한국 시간 기준)
                      </span>
                    </label>
                    <input
                      type="datetime-local"
                      value={newStreamScheduledAt}
                      onChange={(e) => setNewStreamScheduledAt(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors"
                    />
                  </div>
                  {/* 무료배송 설정 */}
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      배송비 설정
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="newFreeShipping"
                          value="DISABLED"
                          checked={newStreamFreeShippingMode === 'DISABLED'}
                          onChange={() => setNewStreamFreeShippingMode('DISABLED')}
                          className="w-4 h-4 text-hot-pink border-gray-300 focus:ring-hot-pink"
                        />
                        <span className="text-sm text-primary-text">기본 배송비 적용</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="newFreeShipping"
                          value="UNCONDITIONAL"
                          checked={newStreamFreeShippingMode === 'UNCONDITIONAL'}
                          onChange={() => setNewStreamFreeShippingMode('UNCONDITIONAL')}
                          className="w-4 h-4 text-hot-pink border-gray-300 focus:ring-hot-pink"
                        />
                        <span className="text-sm text-primary-text">무료배송 (전 주문)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="newFreeShipping"
                          value="THRESHOLD"
                          checked={newStreamFreeShippingMode === 'THRESHOLD'}
                          onChange={() => setNewStreamFreeShippingMode('THRESHOLD')}
                          className="w-4 h-4 text-hot-pink border-gray-300 focus:ring-hot-pink"
                        />
                        <span className="text-sm text-primary-text">기준금액 이상 무료배송</span>
                      </label>
                      {newStreamFreeShippingMode === 'THRESHOLD' && (
                        <div className="ml-7">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-secondary-text">$</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={newStreamFreeShippingThreshold}
                              onChange={(e) => {
                                setNewStreamFreeShippingThreshold(Number(e.target.value));
                                if (Number(e.target.value) > 0) {
                                  setNewStreamFreeShippingMode('THRESHOLD');
                                }
                              }}
                              className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none text-sm"
                            />
                            <span className="text-sm text-secondary-text">이상 무료</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      썸네일 <span className="text-secondary-text text-xs">(선택)</span>
                    </label>
                    {thumbnailPreview ? (
                      <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 aspect-[16/10]">
                        <img
                          src={thumbnailPreview}
                          alt="썸네일 미리보기"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveThumbnail}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isUploadingThumbnail && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">업로드 중...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-hot-pink hover:bg-hot-pink/5 transition-colors">
                        <div className="flex flex-col items-center justify-center py-6">
                          {isUploadingThumbnail ? (
                            <span className="text-secondary-text text-sm">업로드 중...</span>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-secondary-text mb-2" />
                              <span className="text-sm text-secondary-text">
                                클릭하여 이미지 업로드
                              </span>
                              <span className="text-xs text-secondary-text mt-1">
                                JPG, PNG, WEBP (최대 5MB)
                              </span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailFileChange}
                          className="hidden"
                          disabled={isUploadingThumbnail}
                        />
                      </label>
                    )}
                  </div>
                  {generateError && (
                    <div className="p-3 bg-error/10 border border-error rounded-lg">
                      <p className="text-error text-sm">{generateError}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseModal}
                      className="flex-1 py-3 bg-gray-100 text-primary-text rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleGenerateStreamKey}
                      disabled={!newStreamTitle.trim() || isGenerating || isUploadingThumbnail}
                      className="flex-1 py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating ? '발급 중...' : '발급하기'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Stream Key Result */}
              {modalStep === 2 && generatedStream && (
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
                      방송 예정일
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-primary-text">
                      {generatedStream.scheduledAt
                        ? formatDate(generatedStream.scheduledAt)
                        : '미설정'}
                    </div>
                  </div>

                  {generatedStream.thumbnailUrl ? (
                    <div>
                      <label className="block text-sm font-medium text-primary-text mb-2">
                        방송 썸네일
                      </label>
                      <div className="w-full rounded-lg border border-gray-200 overflow-hidden">
                        <img
                          src={generatedStream.thumbnailUrl}
                          alt="생성된 방송 썸네일"
                          className="w-full h-44 object-cover"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      RTMP 스트림 URL (포트 1935)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-primary-text truncate">
                        {getRtmpUrlWithPort(generatedStream.rtmpUrl)}
                      </div>
                      <button
                        onClick={() =>
                          handleCopyToClipboard(
                            getRtmpUrlWithPort(generatedStream.rtmpUrl),
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
                      완료
                    </button>
                    <button
                      onClick={() => {
                        loadRestreamTargets();
                        setModalStep(3);
                      }}
                      className="flex-1 py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 transition-colors"
                    >
                      동시송출 설정 →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Restream Targets */}
              {modalStep === 3 && (
                <div className="space-y-4">
                  {restreamError && (
                    <div className="flex items-center gap-2 p-3 bg-error/10 border border-error rounded-lg text-sm text-error">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {restreamError}
                      <button onClick={() => setRestreamError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Existing targets */}
                  {isLoadingRestream ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-secondary-text" />
                    </div>
                  ) : restreamTargets.length > 0 ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-primary-text">
                        등록된 대상
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={toggleSelectAllRestreamTargets}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-secondary-text hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={selectableRestreamTargetIds.length === 0}
                        >
                          {isAllRestreamTargetsSelected ? '전체 해제' : '전체 선택'}
                        </button>
                        <button
                          onClick={handleBulkDeleteRestreamTargets}
                          disabled={
                            selectedRestreamTargetCount === 0 || isBulkDeletingRestreamTargets
                          }
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-black/5 text-black border border-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isBulkDeletingRestreamTargets
                            ? '삭제 중...'
                            : `일괄 삭제 (${selectedRestreamTargetCount})`}
                        </button>
                      </div>
                      {restreamTargets.map((target) => (
                        <div
                          key={target.id}
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRestreamTargetIds.has(target.id)}
                            onChange={() => toggleRestreamTargetSelection(target.id)}
                            className="h-4 w-4 rounded border-gray-300 text-hot-pink focus:ring-hot-pink shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary-text">{target.name}</p>
                            <p className="text-xs text-secondary-text">
                              {PLATFORM_LABELS[target.platform]}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteRestreamTarget(target.id)}
                            className="p-1.5 text-secondary-text hover:text-error rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Add new target form */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-primary-text mb-3">
                      새 대상 추가
                    </label>

                    {/* Platform selection */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-secondary-text mb-2">
                        플랫폼
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleRestreamPlatformChange(key as ReStreamPlatform)}
                            className={`px-2 py-2 rounded text-xs font-medium border transition-colors ${
                              newRestreamPlatform === key
                                ? 'border-hot-pink bg-hot-pink/10 text-hot-pink'
                                : 'border-gray-200 text-secondary-text hover:border-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-secondary-text mb-1">
                        이름
                      </label>
                      <input
                        type="text"
                        value={newRestreamName}
                        onChange={(e) => setNewRestreamName(e.target.value)}
                        placeholder="예: YouTube 채널"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none"
                      />
                    </div>

                    {/* RTMP URL */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-secondary-text mb-1">
                        RTMP URL
                      </label>
                      <input
                        type="text"
                        value={newRestreamRtmpUrl}
                        onChange={(e) => setNewRestreamRtmpUrl(e.target.value)}
                        placeholder="rtmp://..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none"
                      />
                    </div>

                    {/* Stream Key */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-secondary-text mb-1">
                        스트림 키
                      </label>
                      <input
                        type="password"
                        value={newRestreamKey}
                        onChange={(e) => setNewRestreamKey(e.target.value)}
                        placeholder="스트림 키 입력"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none"
                      />
                    </div>

                    {/* Mute Audio */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setNewRestreamMuteAudio(!newRestreamMuteAudio)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          newRestreamMuteAudio ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            newRestreamMuteAudio ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-xs text-primary-text">오디오 음소거</span>
                    </div>

                    <button
                      onClick={handleAddRestreamTarget}
                      disabled={
                        !newRestreamName.trim() || !newRestreamKey.trim() || isAddingRestream
                      }
                      className="w-full py-2 bg-hot-pink text-white rounded-lg font-medium text-sm hover:bg-hot-pink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isAddingRestream ? '추가 중...' : '추가'}
                    </button>
                  </div>

                  <div className="border-t pt-4">
                    <button
                      onClick={handleCloseModal}
                      className="w-full py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 transition-colors"
                    >
                      완료
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

      {/* Edit Pending Stream Modal */}
      {selectedStreamForEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-primary-text">방송 수정</h2>
              <button
                onClick={handleCloseEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-secondary-text" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-secondary-text">
                <span className="font-medium text-primary-text">
                  &quot;{selectedStreamForEdit.title}&quot;
                </span>
              </p>

              {/* 무료배송 설정 */}
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">
                  배송비 설정
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="editFreeShipping"
                      value="DISABLED"
                      checked={editFreeShippingMode === 'DISABLED'}
                      onChange={() => setEditFreeShippingMode('DISABLED')}
                      className="w-4 h-4 text-hot-pink border-gray-300 focus:ring-hot-pink"
                    />
                    <span className="text-sm text-primary-text">기본 배송비 적용</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="editFreeShipping"
                      value="UNCONDITIONAL"
                      checked={editFreeShippingMode === 'UNCONDITIONAL'}
                      onChange={() => setEditFreeShippingMode('UNCONDITIONAL')}
                      className="w-4 h-4 text-hot-pink border-gray-300 focus:ring-hot-pink"
                    />
                    <span className="text-sm text-primary-text">무료배송 (전 주문)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="editFreeShipping"
                      value="THRESHOLD"
                      checked={editFreeShippingMode === 'THRESHOLD'}
                      onChange={() => setEditFreeShippingMode('THRESHOLD')}
                      className="w-4 h-4 text-hot-pink border-gray-300 focus:ring-hot-pink"
                    />
                    <span className="text-sm text-primary-text">기준금액 이상 무료배송</span>
                  </label>
                  {editFreeShippingMode === 'THRESHOLD' && (
                    <div className="ml-7">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary-text">$</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={editFreeShippingThreshold}
                          onChange={(e) => {
                            setEditFreeShippingThreshold(Number(e.target.value));
                            if (Number(e.target.value) > 0) {
                              setEditFreeShippingMode('THRESHOLD');
                            }
                          }}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none text-sm"
                        />
                        <span className="text-sm text-secondary-text">이상 무료</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 썸네일 */}
              <div>
                <p className="block text-sm font-medium text-primary-text mb-2">썸네일</p>
                {editThumbnailPreview ? (
                  <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 aspect-[16/10]">
                    <img
                      src={editThumbnailPreview}
                      alt="썸네일 미리보기"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveEditThumbnail}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isUploadingEditThumbnail && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">업로드 중...</span>
                      </div>
                    )}
                  </div>
                ) : selectedStreamForEdit.thumbnailUrl ? (
                  <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 aspect-[16/10]">
                    <img
                      src={selectedStreamForEdit.thumbnailUrl}
                      alt="현재 썸네일"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      현재 썸네일
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-hot-pink hover:bg-hot-pink/5 transition-colors">
                    <div className="flex flex-col items-center justify-center py-6">
                      {isUploadingEditThumbnail ? (
                        <span className="text-secondary-text text-sm">업로드 중...</span>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-secondary-text mb-2" />
                          <span className="text-sm text-secondary-text">
                            클릭하여 이미지 업로드
                          </span>
                          <span className="text-xs text-secondary-text mt-1">
                            JPG, PNG, WEBP (최대 5MB)
                          </span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditThumbnailFileChange}
                      className="hidden"
                      disabled={isUploadingEditThumbnail}
                    />
                  </label>
                )}
                {selectedStreamForEdit.thumbnailUrl && (
                  <label className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:border-hot-pink/50 transition-colors text-sm text-secondary-text">
                    <Upload className="w-4 h-4" />
                    {editThumbnailPreview ? '다시 선택' : '변경'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditThumbnailFileChange}
                      className="hidden"
                      disabled={isUploadingEditThumbnail}
                    />
                  </label>
                )}
              </div>

              {editError && (
                <div className="p-3 bg-error/10 border border-error rounded-lg">
                  <p className="text-error text-sm">{editError}</p>
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-success/10 border border-success rounded-lg">
                  <p className="text-success text-sm">{editSuccess}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCloseEditModal}
                  className="flex-1 py-3 bg-gray-100 text-primary-text rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || isUploadingEditThumbnail}
                  className="flex-1 py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSavingEdit ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
