'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Filter,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  entity: string;
  entityId: string;
  changes: any;
}

interface AuditLogsResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: '생성', color: 'bg-green-100 text-green-700' },
  UPDATE: { label: '수정', color: 'bg-blue-100 text-blue-700' },
  DELETE: { label: '삭제', color: 'bg-red-100 text-red-700' },
  CONFIRM_PAYMENT: { label: '입금확인', color: 'bg-purple-100 text-purple-700' },
  SEND_NOTIFICATION: { label: '알림발송', color: 'bg-pink-100 text-pink-700' },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 50 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchAuditLogs(1);
  }, []);

  const fetchAuditLogs = async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const params: any = { page, limit: 50 };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (actionFilter) params.action = actionFilter;
      const response = await apiClient.get<AuditLogsResponse>('/admin/audit-logs', { params });
      setLogs(response.data.data);
      setMeta(response.data.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || '관리 기록을 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setActionFilter('');
    fetchAuditLogs(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= meta.totalPages) {
      fetchAuditLogs(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleExportCSV = () => {
    const headers = ['시간', '관리자 이메일', '작업', '대상', '대상 ID', '변경 내역'];
    const rows = logs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.adminEmail,
      log.action,
      log.entity,
      log.entityId,
      JSON.stringify(log.changes),
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-700' };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#FF4D8D]" />
            관리 기록
          </h1>
          <p className="text-sm text-gray-500 mt-1">모든 관리자 작업 및 변경 사항을 추적합니다</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={logs.length === 0}>
          <Download className="w-4 h-4 mr-1.5" />
          CSV 내보내기
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#FF4D8D]" />
          <h3 className="text-sm font-semibold text-gray-900">필터</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input
            label="시작일"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            fullWidth
          />
          <Input
            label="종료일"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">작업 유형</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-[#FF4D8D] transition-colors"
            >
              <option value="">전체 작업</option>
              <option value="CREATE">생성</option>
              <option value="UPDATE">수정</option>
              <option value="DELETE">삭제</option>
              <option value="CONFIRM_PAYMENT">입금 확인</option>
              <option value="SEND_NOTIFICATION">알림 발송</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => fetchAuditLogs(1)}>
            필터 적용
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            초기화
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      {isLoading && logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#FF4D8D] animate-spin" />
            <p className="text-sm text-gray-500">기록을 불러오는 중...</p>
          </div>
        </div>
      ) : logs.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      시간
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      관리자
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      작업
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      대상
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      상세 내용
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDate(log.timestamp)}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-800">{log.adminEmail}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-sm text-gray-800">{log.entity}</span>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">
                            {log.entityId.substring(0, 12)}...
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {log.changes && typeof log.changes === 'object'
                            ? Object.entries(log.changes as Record<string, unknown>)
                                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                .join(' | ')
                            : String(log.changes ?? '-')}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-5 py-3.5">
              <span className="text-sm text-gray-500">
                총 {meta.total}건 중 {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)}건 표시
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(meta.page - 1)}
                  disabled={meta.page === 1 || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-700 px-2">
                  {meta.page} / {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(meta.page + 1)}
                  disabled={meta.page === meta.totalPages || isLoading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-500 mb-1">기록이 없습니다</h3>
          <p className="text-sm text-gray-400">관리자가 작업을 수행하면 여기에 기록이 표시됩니다</p>
        </div>
      )}
    </div>
  );
}
