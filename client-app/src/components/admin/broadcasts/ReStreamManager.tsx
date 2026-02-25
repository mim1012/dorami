'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import {
  getReStreamTargets,
  createReStreamTarget,
  updateReStreamTarget,
  deleteReStreamTarget,
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

  // Actions loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    if (!liveStreamId || !isLive) return;
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, [liveStreamId, isLive, fetchStatuses]);

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

  const getTargetStatus = (targetId: string): ReStreamLog | undefined => {
    return statuses.find((s) => s.targetId === targetId);
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
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-hot-pink text-white rounded-lg text-sm font-medium hover:bg-hot-pink/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          추가
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
      {targets.length === 0 ? (
        <div className="text-center py-8 text-secondary-text">
          <WifiOff className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">등록된 동시 송출 대상이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => {
            const log = getTargetStatus(target.id);
            const currentStatus: ReStreamStatus = log?.status || 'IDLE';
            const isActive = currentStatus === 'ACTIVE' || currentStatus === 'CONNECTING';

            return (
              <div
                key={target.id}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg"
              >
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
