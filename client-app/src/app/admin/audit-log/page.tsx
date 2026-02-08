'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { ChevronLeft, ChevronRight, FileText, Download, Filter } from 'lucide-react';

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

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 50 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
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
      console.error('Failed to fetch audit logs:', err);
      setError(err.response?.data?.message || '관리 기록을 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchAuditLogs(1);
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
    // Create CSV content
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

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke the object URL to prevent memory leak
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">관리 기록을 불러오는 중...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Display className="text-hot-pink mb-2 flex items-center gap-3">
            <FileText className="w-10 h-10" />
            관리 기록
          </Display>
          <Body className="text-secondary-text">
            모든 관리자 작업 및 변경 사항을 추적합니다
          </Body>
        </div>

        {/* Filters */}
        <div className="bg-content-bg rounded-button p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-hot-pink" />
            <Heading2 className="text-primary-text">필터</Heading2>
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
              <label className="block text-sm font-medium text-primary-text mb-2">작업 유형</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-button bg-white text-primary-text focus:outline-none focus:ring-2 focus:ring-hot-pink focus:border-transparent"
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

          <div className="flex gap-3">
            <Button variant="primary" size="sm" onClick={handleApplyFilters}>
              필터 적용
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              초기화
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={logs.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              CSV 내보내기
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error}</Caption>
          </div>
        )}

        {/* Audit Log Table */}
        {logs.length > 0 ? (
          <>
            <div className="bg-white rounded-button border border-content-bg overflow-x-auto mb-4">
              <table className="min-w-full">
                <thead className="bg-content-bg">
                  <tr>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      시간
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      관리자
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      작업
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      대상
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      상세
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-content-bg">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-content-bg/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Caption className="text-primary-text">{formatDate(log.timestamp)}</Caption>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Body className="text-primary-text">{log.adminEmail}</Body>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-hot-pink/10 text-hot-pink rounded-button text-caption font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <Caption className="text-secondary-text">{log.entity}</Caption>
                          <Body className="text-primary-text font-mono text-caption">{log.entityId.substring(0, 12)}...</Body>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Caption className="text-secondary-text line-clamp-2">
                          {JSON.stringify(log.changes)}
                        </Caption>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between bg-content-bg rounded-button px-6 py-4">
                <Caption className="text-secondary-text">
                  총 {meta.total}건 중 {(meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)}건 표시
                </Caption>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(meta.page - 1)}
                    disabled={meta.page === 1 || isLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <Body className="text-primary-text">
                    {meta.page} / {meta.totalPages} 페이지
                  </Body>

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
          <div className="bg-content-bg rounded-button p-12 text-center">
            <div className="w-16 h-16 mb-4 rounded-xl bg-gray-100 flex items-center justify-center"><svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg></div>
            <Heading2 className="text-secondary-text mb-2">기록이 없습니다</Heading2>
            <Body className="text-secondary-text">
              관리자가 작업을 수행하면 여기에 기록이 표시됩니다
            </Body>
          </div>
        )}
      </div>
    </div>
  );
}
