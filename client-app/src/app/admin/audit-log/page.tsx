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
      setError(err.response?.data?.message || 'Failed to load audit logs');
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
    const headers = ['Timestamp', 'Admin Email', 'Action', 'Entity', 'Entity ID', 'Changes'];
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
    return date.toLocaleString('en-US', {
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
        <Body className="text-secondary-text">Loading audit logs...</Body>
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
            Audit Log
          </Display>
          <Body className="text-secondary-text">
            Track all administrative actions and changes
          </Body>
        </div>

        {/* Filters */}
        <div className="bg-content-bg rounded-button p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-hot-pink" />
            <Heading2 className="text-primary-text">Filters</Heading2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
            />
            <Input
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
            />
            <div>
              <label className="block text-sm font-medium text-primary-text mb-2">Action Type</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-button bg-white text-primary-text focus:outline-none focus:ring-2 focus:ring-hot-pink focus:border-transparent"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="CONFIRM_PAYMENT">Confirm Payment</option>
                <option value="SEND_NOTIFICATION">Send Notification</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="primary" size="sm" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={logs.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
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
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                      Details
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
                  Showing {(meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} logs
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
                    Page {meta.page} of {meta.totalPages}
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
            <div className="text-6xl mb-4">📋</div>
            <Heading2 className="text-secondary-text mb-2">No Audit Logs Found</Heading2>
            <Body className="text-secondary-text">
              Audit logs will appear here as admins perform actions
            </Body>
          </div>
        )}
      </div>
    </div>
  );
}
