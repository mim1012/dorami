'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';
import {
  getAdminNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  type Notice,
} from '@/lib/api/notices';

type NoticeCategory = 'IMPORTANT' | 'GENERAL';

interface NoticeForm {
  title: string;
  content: string;
  category: NoticeCategory;
}

const EMPTY_FORM: NoticeForm = { title: '', content: '', category: 'GENERAL' };

export function NoticeListManagement() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<NoticeForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ['admin', 'notices'],
    queryFn: getAdminNotices,
  });

  const createMutation = useMutation({
    mutationFn: createNotice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'active'] });
      setForm(EMPTY_FORM);
      showToast('공지가 등록되었습니다.', 'success');
    },
    onError: () => showToast('공지 등록에 실패했습니다.', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateNotice>[1] }) =>
      updateNotice(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'active'] });
      setEditingId(null);
      setForm(EMPTY_FORM);
      showToast('공지가 수정되었습니다.', 'success');
    },
    onError: () => showToast('공지 수정에 실패했습니다.', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateNotice(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'active'] });
    },
    onError: () => showToast('상태 변경에 실패했습니다.', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'active'] });
      showToast('공지가 삭제되었습니다.', 'success');
    },
    onError: () => showToast('공지 삭제에 실패했습니다.', 'error'),
  });

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, dto: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setForm({ title: notice.title, content: notice.content, category: notice.category });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '공지 삭제',
      message: '이 공지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (confirmed) deleteMutation.mutate(id);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary-text mb-2 flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-hot-pink" />
          공지 목록 관리
        </h2>
        <p className="text-secondary-text">
          확성기 아이콘 클릭 시 표시되는 중요/일반 공지를 관리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="bg-content-bg border border-gray-200 rounded-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-primary-text">
            {editingId ? '공지 수정' : '새 공지 등록'}
          </h3>

          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">카테고리</label>
            <div className="flex gap-3">
              {(['IMPORTANT', 'GENERAL'] as NoticeCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat })}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.category === cat
                      ? 'bg-hot-pink text-white border-hot-pink'
                      : 'bg-white text-secondary-text border-gray-200 hover:border-hot-pink'
                  }`}
                >
                  {cat === 'IMPORTANT' && <AlertCircle className="w-4 h-4" />}
                  {cat === 'IMPORTANT' ? '중요' : '일반'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="공지 제목을 입력하세요"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-primary-text placeholder:text-secondary-text focus:outline-none focus:border-hot-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">내용</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="공지 내용을 입력하세요"
              rows={5}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-primary-text placeholder:text-secondary-text focus:outline-none focus:border-hot-pink resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-hot-pink hover:bg-hot-pink/90 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(255,0,122,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editingId ? '수정 완료' : '등록'}
            </button>
            {editingId && (
              <button
                onClick={handleCancelEdit}
                className="px-6 py-3 bg-content-bg border border-gray-200 text-primary-text rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            )}
          </div>
        </div>

        {/* Right: Notice list */}
        <div className="bg-content-bg border border-gray-200 rounded-card p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">등록된 공지</h3>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-hot-pink animate-spin" />
            </div>
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-secondary-text text-sm">등록된 공지가 없습니다</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {notices.map((notice) => (
                <li
                  key={notice.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    notice.isActive
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {notice.category === 'IMPORTANT' && (
                          <AlertCircle className="w-3.5 h-3.5 text-hot-pink flex-shrink-0" />
                        )}
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            notice.category === 'IMPORTANT'
                              ? 'bg-hot-pink/10 text-hot-pink'
                              : 'bg-gray-100 text-secondary-text'
                          }`}
                        >
                          {notice.category === 'IMPORTANT' ? '중요' : '일반'}
                        </span>
                      </div>
                      <p className="font-semibold text-primary-text text-sm truncate">
                        {notice.title}
                      </p>
                      <p className="text-secondary-text text-xs mt-0.5 line-clamp-2">
                        {notice.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() =>
                          toggleMutation.mutate({ id: notice.id, isActive: !notice.isActive })
                        }
                        disabled={toggleMutation.isPending}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-secondary-text hover:text-primary-text"
                        aria-label={notice.isActive ? '비활성화' : '활성화'}
                        title={notice.isActive ? '비활성화' : '활성화'}
                      >
                        {notice.isActive ? (
                          <ToggleRight className="w-5 h-5 text-hot-pink" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(notice)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-secondary-text hover:text-primary-text text-xs font-medium px-2"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(notice.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-secondary-text hover:text-red-500"
                        aria-label="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
