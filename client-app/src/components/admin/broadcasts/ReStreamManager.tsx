'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  Trash2,
  Edit3,
  Play,
  Square,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getReStreamTargets,
  createReStreamTarget,
  updateReStreamTarget,
  deleteReStreamTarget,
  deleteReStreamTargets,
  getReStreamStatuses,
  startReStreamTarget,
  stopReStreamTarget,
  type ReStreamTarget,
  type ReStreamLog,
  type ReStreamPlatform,
  type ReStreamStatus,
  type CreateReStreamTargetPayload,
} from '@/lib/api/restream';

const PLATFORM_OPTIONS: { value: ReStreamPlatform; label: string; defaultUrl: string }[] = [
  { value: 'YOUTUBE', label: 'YouTube', defaultUrl: 'rtmp://a.rtmp.youtube.com/live2/' },
  {
    value: 'INSTAGRAM',
    label: 'Instagram',
    defaultUrl: 'rtmps://live-upload.instagram.com:443/rtmp/',
  },
  { value: 'TIKTOK', label: 'TikTok', defaultUrl: 'rtmp://push.rtmp.tiktok.com/live/' },
  { value: 'CUSTOM', label: 'Custom', defaultUrl: '' },
];

type ReStreamStatusFilter = 'ALL' | ReStreamStatus;

const STATUS_FILTER_OPTIONS: { value: ReStreamStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '송출중' },
  { value: 'CONNECTING', label: '연결중' },
  { value: 'FAILED', label: '오류' },
  { value: 'STOPPED', label: '중지됨' },
  { value: 'IDLE', label: '대기' },
];

const STATUS_DISPLAY_ORDER: Record<ReStreamStatus, number> = {
  ACTIVE: 0,
  CONNECTING: 1,
  FAILED: 2,
  STOPPED: 3,
  IDLE: 4,
};

function toLocalTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeStatus(
  logs: ReStreamLog[] | undefined,
  targetId: string,
): ReStreamLog | undefined {
  if (!logs) return undefined;
  return logs
    .filter((log) => log.targetId === targetId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function getStatusColor(status: ReStreamStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-success/10 text-success border-success';
    case 'CONNECTING':
      return 'bg-warning/10 text-warning border-warning';
    case 'FAILED':
      return 'bg-error/10 text-error border-error';
    case 'STOPPED':
      return 'bg-secondary-text/10 text-secondary-text border-secondary-text';
    default:
      return 'bg-secondary-text/10 text-secondary-text border-secondary-text';
  }
}

function getStatusLabel(status: ReStreamStatus) {
  switch (status) {
    case 'ACTIVE':
      return '송출중';
    case 'CONNECTING':
      return '연결중';
    case 'FAILED':
      return '오류';
    case 'STOPPED':
      return '중지됨';
    default:
      return '대기';
  }
}

function getPlatformLabel(platform: ReStreamPlatform) {
  return PLATFORM_OPTIONS.find((p) => p.value === platform)?.label || platform;
}

interface ReStreamManagerProps {
  liveStreamId?: string | null;
  isLive?: boolean;
}

export default function ReStreamManager({ liveStreamId, isLive }: ReStreamManagerProps) {
  const [targets, setTargets] = useState<ReStreamTarget[]>([]);
  const [statuses, setStatuses] = useState<ReStreamLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ReStreamTarget | null>(null);

  // Form state
  const [formPlatform, setFormPlatform] = useState<ReStreamPlatform>('YOUTUBE');
  const [formName, setFormName] = useState('');
  const [formRtmpUrl, setFormRtmpUrl] = useState('');
  const [formStreamKey, setFormStreamKey] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formMuteAudio, setFormMuteAudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showStreamKeys, setShowStreamKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReStreamStatusFilter>('ALL');
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  // Actions loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState<'start' | 'stop' | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchTargets = useCallback(async () => {
    try {
      const data = await getReStreamTargets();
      setTargets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load restream targets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    if (!liveStreamId) return;
    try {
      const data = await getReStreamStatuses(liveStreamId);
      setStatuses(data);
    } catch {
      // Silently fail status polling
    }
  }, [liveStreamId]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  useEffect(() => {
    setSelectedTargetIds((prev) => {
      const next = new Set<string>();
      const validIds = new Set(targets.map((target) => target.id));
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [targets]);

  useEffect(() => {
    if (!liveStreamId || !isLive) return;
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, [liveStreamId, isLive, fetchStatuses]);

  useEffect(() => {
    setSelectedTargetIds(new Set());
  }, [searchQuery, statusFilter]);

  // WebSocket listener for real-time status updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStatusUpdate = (event: CustomEvent) => {
      const { targetId, status } = event.detail;
      setStatuses((prev) => prev.map((s) => (s.targetId === targetId ? { ...s, status } : s)));
    };

    window.addEventListener('restream:status:updated' as any, handleStatusUpdate as any);
    return () => {
      window.removeEventListener('restream:status:updated' as any, handleStatusUpdate as any);
    };
  }, []);

  const getTargetStatus = useCallback(
    (targetId: string): ReStreamStatus => {
      const latest = normalizeStatus(statuses, targetId);
      return latest?.status || 'IDLE';
    },
    [statuses],
  );

  const getTargetLog = useCallback(
    (targetId: string): ReStreamLog | undefined => normalizeStatus(statuses, targetId),
    [statuses],
  );

  const filteredTargets = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const base = targets.filter((target) => {
      if (!keyword) return true;
      return (
        target.name.toLowerCase().includes(keyword) ||
        getPlatformLabel(target.platform).toLowerCase().includes(keyword) ||
        target.rtmpUrl.toLowerCase().includes(keyword)
      );
    });

    if (statusFilter === 'ALL') return base;
    return base.filter((target) => getTargetStatus(target.id) === statusFilter);
  }, [targets, searchQuery, statusFilter, getTargetStatus]);

  const visibleTargets = useMemo(() => {
    const sorted = [...filteredTargets].sort((a, b) => {
      const aStatus = getTargetStatus(a.id);
      const bStatus = getTargetStatus(b.id);
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (aStatus !== bStatus) return STATUS_DISPLAY_ORDER[aStatus] - STATUS_DISPLAY_ORDER[bStatus];
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [filteredTargets, getTargetStatus]);

  const displayedTargets = useMemo(() => {
    const limit = 8;
    if (showAllTargets) return visibleTargets;
    return visibleTargets.slice(0, limit);
  }, [visibleTargets, showAllTargets]);

  const hasMoreTargets = visibleTargets.length > 8;

  const failedTargets = useMemo(
    () => visibleTargets.filter((t) => getTargetStatus(t.id) === 'FAILED'),
    [visibleTargets, getTargetStatus],
  );

  const statusSummary = useMemo(() => {
    return visibleTargets.reduce(
      (acc, target) => {
        acc.total += 1;
        if (target.enabled) acc.enabled += 1;
        const status = getTargetStatus(target.id);
        if (status === 'ACTIVE') acc.live += 1;
        else if (status === 'CONNECTING') acc.connecting += 1;
        else if (status === 'FAILED') acc.failed += 1;
        else if (status === 'STOPPED') acc.stopped += 1;
        else acc.idle += 1;
        return acc;
      },
      { total: 0, enabled: 0, live: 0, connecting: 0, failed: 0, stopped: 0, idle: 0 },
    );
  }, [visibleTargets, getTargetStatus]);

  const selectableTargetIds = useMemo(
    () => visibleTargets.map((target) => target.id),
    [visibleTargets],
  );

  const areAllTargetsSelected = useMemo(
    () =>
      selectableTargetIds.length > 0 &&
      selectableTargetIds.every((targetId) => selectedTargetIds.has(targetId)),
    [selectableTargetIds, selectedTargetIds],
  );

  const selectedTargetCount = selectedTargetIds.size;

  const canBulkStart = useMemo(
    () =>
      visibleTargets.some((target) => {
        const status = getTargetStatus(target.id);
        return target.enabled && status !== 'ACTIVE' && status !== 'CONNECTING';
      }),
    [visibleTargets, getTargetStatus],
  );

  const canBulkStop = useMemo(
    () =>
      visibleTargets.some((target) => {
        const status = getTargetStatus(target.id);
        return target.enabled && (status === 'ACTIVE' || status === 'CONNECTING');
      }),
    [visibleTargets, getTargetStatus],
  );

  const toggleTargetSelection = (targetId: string) => {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  };

  const toggleSelectAllTargets = () => {
    setSelectedTargetIds((prev) => {
      if (areAllTargetsSelected) {
        return new Set();
      }

      return new Set([...prev, ...selectableTargetIds]);
    });
  };

  const handleBulkDeleteTargets = async () => {
    if (selectedTargetIds.size === 0) return;
    const ids = Array.from(selectedTargetIds);
    if (!confirm(`선택한 동시 송출 대상 ${ids.length}개를 삭제하시겠습니까?`)) return;

    setIsBulkDeleting(true);
    try {
      await deleteReStreamTargets(ids);

      await fetchTargets();
      setSelectedTargetIds(new Set());
    } catch (err: any) {
      setError(err.message || '일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openCreateModal = () => {
    setEditingTarget(null);
    setFormPlatform('YOUTUBE');
    setFormName('');
    setFormRtmpUrl(PLATFORM_OPTIONS[0].defaultUrl);
    setFormStreamKey('');
    setFormEnabled(true);
    setFormMuteAudio(false);
    setShowModal(true);
  };

  const openEditModal = (target: ReStreamTarget) => {
    setEditingTarget(target);
    setFormPlatform(target.platform);
    setFormName(target.name);
    setFormRtmpUrl(target.rtmpUrl);
    setFormStreamKey(target.streamKey);
    setFormEnabled(target.enabled);
    setFormMuteAudio(target.muteAudio ?? false);
    setShowModal(true);
  };

  const handlePlatformChange = (platform: ReStreamPlatform) => {
    setFormPlatform(platform);
    const option = PLATFORM_OPTIONS.find((p) => p.value === platform);
    if (option && !editingTarget) {
      setFormRtmpUrl(option.defaultUrl);
    }
    // Instagram은 기본적으로 음소거 권장
    if (platform === 'INSTAGRAM') setFormMuteAudio(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formRtmpUrl.trim() || !formStreamKey.trim()) return;
    setIsSaving(true);
    setError(null);

    try {
      if (editingTarget) {
        await updateReStreamTarget(editingTarget.id, {
          platform: formPlatform,
          name: formName.trim(),
          rtmpUrl: formRtmpUrl.trim(),
          streamKey: formStreamKey.trim(),
          enabled: formEnabled,
          muteAudio: formMuteAudio,
        });
      } else {
        await createReStreamTarget({
          platform: formPlatform,
          name: formName.trim(),
          rtmpUrl: formRtmpUrl.trim(),
          streamKey: formStreamKey.trim(),
          enabled: formEnabled,
          muteAudio: formMuteAudio,
        });
      }
      setShowModal(false);
      await fetchTargets();
    } catch (err: any) {
      setError(err.message || 'Failed to save target');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 동시 송출 대상을 삭제하시겠습니까?')) return;
    try {
      await deleteReStreamTarget(id);
      setSelectedTargetIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchTargets();
    } catch (err: any) {
      setError(err.message || 'Failed to delete target');
    }
  };

  const handleStart = async (targetId: string) => {
    if (!liveStreamId) return;
    setActionLoading(targetId);
    try {
      await startReStreamTarget(liveStreamId, targetId);
      await fetchStatuses();
    } catch (err: any) {
      setError(err.message || 'Failed to start restream');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (targetId: string) => {
    if (!liveStreamId) return;
    setActionLoading(targetId);
    try {
      await stopReStreamTarget(liveStreamId, targetId);
      await fetchStatuses();
    } catch (err: any) {
      setError(err.message || 'Failed to stop restream');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkStart = async () => {
    if (!liveStreamId || !isLive) return;
    const targetsToStart = visibleTargets.filter((target) => {
      const status = getTargetStatus(target.id);
      return target.enabled && status !== 'ACTIVE' && status !== 'CONNECTING';
    });
    if (targetsToStart.length === 0) return;

    setBulkActionLoading('start');
    try {
      const results = await Promise.allSettled(
        targetsToStart.map((target) => startReStreamTarget(liveStreamId, target.id)),
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        setError(`일괄 시작: ${failedCount}개 대상 실패`);
      }
      await fetchStatuses();
    } catch {
      setError('일괄 시작 처리 중 문제가 발생했습니다.');
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkStop = async () => {
    if (!liveStreamId || !isLive) return;
    const targetsToStop = visibleTargets.filter((target) => {
      const status = getTargetStatus(target.id);
      return target.enabled && (status === 'ACTIVE' || status === 'CONNECTING');
    });
    if (targetsToStop.length === 0) return;

    setBulkActionLoading('stop');
    try {
      const results = await Promise.allSettled(
        targetsToStop.map((target) => stopReStreamTarget(liveStreamId, target.id)),
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        setError(`일괄 중지: ${failedCount}개 대상 실패`);
      }
      await fetchStatuses();
    } catch {
      setError('일괄 중지 처리 중 문제가 발생했습니다.');
    } finally {
      setBulkActionLoading(null);
    }
  };

  const toggleStreamKeyVisibility = (id: string) => {
    setShowStreamKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleErrorExpanded = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-secondary-text" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          동시 송출 관리
        </h3>
        <div className="text-xs text-secondary-text bg-gray-100 px-2 py-1 rounded">
          {statusSummary.total}개 대상
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="px-3 py-2 rounded-lg border border-success/20 bg-success/5 text-success text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>송출중 {statusSummary.live}</span>
        </div>
        <div className="px-3 py-2 rounded-lg border border-warning/20 bg-warning/5 text-warning text-sm font-medium flex items-center gap-2">
          <Loader2 className="w-4 h-4" />
          <span>연결중 {statusSummary.connecting}</span>
        </div>
        <div className="px-3 py-2 rounded-lg border border-error/20 bg-error/5 text-error text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>오류 {statusSummary.failed}</span>
        </div>
        <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-secondary-text text-sm font-medium">
          <span>활성 {statusSummary.enabled}</span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-secondary-text" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="대상 검색 (이름/플랫폼/URL)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
          />
          {isLive && liveStreamId && (
            <button
              onClick={() => fetchStatuses()}
              className="px-2 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-100"
              title="상태 새로고침"
            >
              <RefreshCw className="w-4 h-4 text-secondary-text" />
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Filter className="w-4 h-4 text-secondary-text" />
          {STATUS_FILTER_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium border ${
                  isActive
                    ? 'border-hot-pink bg-hot-pink/10 text-hot-pink'
                    : 'border-gray-200 text-secondary-text hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {failedTargets.length > 0 ? (
          <p className="text-xs text-error">
            오류 대상 {failedTargets.length}개 · 재접속/설정 점검 필요
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSelectAllTargets}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-secondary-text hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectableTargetIds.length === 0}
          >
            {areAllTargetsSelected ? '전체 해제' : '전체 선택'}
          </button>
          <button
            onClick={handleBulkDeleteTargets}
            disabled={selectedTargetIds.size === 0 || isBulkDeleting}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-black/5 text-black border border-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBulkDeleting ? '삭제 중...' : `일괄 삭제 (${selectedTargetCount})`}
          </button>
          <button
            onClick={handleBulkStart}
            disabled={!isLive || !liveStreamId || bulkActionLoading === 'start' || !canBulkStart}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-success/10 text-success border border-success/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkActionLoading === 'start' ? '일괄 시작 중...' : '일괄 시작'}
          </button>
          <button
            onClick={handleBulkStop}
            disabled={!isLive || !liveStreamId || bulkActionLoading === 'stop' || !canBulkStop}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-error/10 text-error border border-error/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkActionLoading === 'stop' ? '일괄 중지 중...' : '일괄 중지'}
          </button>
          <button
            onClick={() => setShowAllTargets((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-secondary-text hover:bg-gray-100"
            disabled={!hasMoreTargets}
          >
            {showAllTargets
              ? '접기'
              : `더보기${hasMoreTargets ? ` (+${visibleTargets.length - 8}개)` : ''}`}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-hot-pink text-white rounded-lg text-sm font-medium hover:bg-hot-pink/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          대상 추가
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-error/10 border border-error rounded-lg text-sm text-error">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Target List */}
      {visibleTargets.length === 0 ? (
        <div className="text-center py-8 text-secondary-text">
          <WifiOff className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">조건에 맞는 대상이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedTargets.map((target) => {
            const log = getTargetLog(target.id);
            const currentStatus: ReStreamStatus = getTargetStatus(target.id);
            const isActive = currentStatus === 'ACTIVE' || currentStatus === 'CONNECTING';
            const isFailedExpanded = expandedErrors.has(target.id);
            const errorText = (log?.errorMessage || '').trim();

            return (
              <div
                key={target.id}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg"
              >
                <input
                  type="checkbox"
                  checked={selectedTargetIds.has(target.id)}
                  onChange={() => toggleTargetSelection(target.id)}
                  className="h-4 w-4 rounded border-gray-300 text-hot-pink focus:ring-hot-pink shrink-0"
                />

                {/* Platform badge */}
                <div className="shrink-0">
                  <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-medium text-primary-text">
                    {getPlatformLabel(target.platform)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-primary-text truncate">
                      {target.name}
                    </span>
                    {!target.enabled && (
                      <span className="text-xs text-secondary-text bg-gray-100 px-1.5 py-0.5 rounded">
                        비활성
                      </span>
                    )}
                    {target.muteAudio && (
                      <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                        음소거
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-secondary-text font-mono truncate">
                      {target.rtmpUrl}
                    </span>
                    <button
                      onClick={() => toggleStreamKeyVisibility(target.id)}
                      className="shrink-0 text-secondary-text hover:text-primary-text"
                    >
                      {showStreamKeys.has(target.id) ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </button>
                    {showStreamKeys.has(target.id) && (
                      <span className="text-xs text-secondary-text font-mono">
                        {target.streamKey}
                      </span>
                    )}
                  </div>
                  {currentStatus === 'FAILED' && errorText ? (
                    <button
                      onClick={() => toggleErrorExpanded(target.id)}
                      className="mt-1 text-xs text-error text-left flex items-start gap-1 hover:underline"
                    >
                      <span
                        className={`inline-block ${isFailedExpanded ? '' : 'truncate max-w-[220px]'}`}
                      >
                        {isFailedExpanded ? errorText : `${errorText.slice(0, 45)}...`}
                      </span>
                      {isFailedExpanded ? (
                        <ChevronUp className="w-3 h-3 mt-0.5" />
                      ) : (
                        <ChevronDown className="w-3 h-3 mt-0.5" />
                      )}
                    </button>
                  ) : null}
                  {log && (
                    <p className="text-xs text-secondary-text mt-1">
                      {toLocalTime(log.startedAt)} 재시작 {log.restartCount || 0}회
                    </p>
                  )}
                </div>

                {/* Status */}
                {isLive && liveStreamId && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(currentStatus)}`}
                  >
                    {currentStatus === 'CONNECTING' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {getStatusLabel(currentStatus)}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isLive && liveStreamId && (
                    <>
                      {isActive ? (
                        <button
                          onClick={() => handleStop(target.id)}
                          disabled={actionLoading === target.id}
                          className="p-1.5 text-error hover:bg-error/10 rounded transition-colors disabled:opacity-50"
                          title="중지"
                        >
                          {actionLoading === target.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStart(target.id)}
                          disabled={actionLoading === target.id}
                          className="p-1.5 text-success hover:bg-success/10 rounded transition-colors disabled:opacity-50"
                          title="시작"
                        >
                          {actionLoading === target.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => openEditModal(target)}
                    className="p-1.5 text-secondary-text hover:bg-gray-100 rounded transition-colors"
                    title="수정"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(target.id)}
                    className="p-1.5 text-secondary-text hover:bg-error/10 hover:text-error rounded transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-primary-text">
                {editingTarget ? '동시 송출 대상 수정' : '동시 송출 대상 추가'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-secondary-text" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Platform */}
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">플랫폼</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLATFORM_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handlePlatformChange(opt.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        formPlatform === opt.value
                          ? 'border-hot-pink bg-hot-pink/10 text-hot-pink'
                          : 'border-gray-200 text-secondary-text hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">이름</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="예: YouTube 채널"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors"
                />
              </div>

              {/* RTMP URL */}
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">RTMP URL</label>
                <input
                  type="text"
                  value={formRtmpUrl}
                  onChange={(e) => setFormRtmpUrl(e.target.value)}
                  placeholder="rtmp://..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors font-mono text-sm"
                />
              </div>

              {/* Stream Key */}
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">
                  스트림 키
                </label>
                <input
                  type="password"
                  value={formStreamKey}
                  onChange={(e) => setFormStreamKey(e.target.value)}
                  placeholder="스트림 키 입력"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hot-pink focus:border-hot-pink outline-none transition-colors font-mono text-sm"
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormEnabled(!formEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formEnabled ? 'bg-hot-pink' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-primary-text">
                  {formEnabled ? '활성화' : '비활성화'}
                </span>
              </div>

              {/* Mute Audio toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormMuteAudio(!formMuteAudio)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formMuteAudio ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formMuteAudio ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <span className="text-sm text-primary-text">오디오 음소거</span>
                  <p className="text-xs text-secondary-text">
                    Instagram 동시송출 시 권장 (저작권 보호)
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-primary-text rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !formName.trim() || !formRtmpUrl.trim() || !formStreamKey.trim() || isSaving
                  }
                  className="flex-1 py-3 bg-hot-pink text-white rounded-lg font-medium hover:bg-hot-pink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? '저장 중...' : editingTarget ? '수정' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
