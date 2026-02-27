'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  Loader2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

interface SettlementSummary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalShippingFee: number;
}

interface SettlementOrder {
  orderId: string;
  orderDate: string;
  customerId: string;
  total: number;
  paidAt: string;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  orderCount: number;
}

interface SettlementReport {
  summary: SettlementSummary;
  orders: SettlementOrder[];
  dailyRevenue: DailyRevenue[];
  dateRange: { from: string; to: string };
}

type SortField = 'orderDate' | 'total' | 'paidAt';
type SortOrder = 'asc' | 'desc';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SettlementPage() {
  const getCurrentMonthStart = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getCurrentMonthEnd = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  const [fromDate, setFromDate] = useState(getCurrentMonthStart());
  const [toDate, setToDate] = useState(getCurrentMonthEnd());
  const [report, setReport] = useState<SettlementReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [sortField, setSortField] = useState<SortField>('paidAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isExcelLoading, setIsExcelLoading] = useState(false);

  const validateDateRange = (): string | null => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) return '시작일은 종료일보다 이전이어야 합니다';
    if (to.getTime() - from.getTime() > 365 * 24 * 60 * 60 * 1000)
      return '최대 조회 기간은 1년입니다';
    return null;
  };

  const handleGenerate = async () => {
    const validationError = validateDateRange();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);
    try {
      const response = await apiClient.get<SettlementReport>('/admin/settlement', {
        params: { from: fromDate, to: toDate },
      });
      setReport(response.data);
    } catch (err: any) {
      setError(err.message || '리포트 생성 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!report) return;
    const headers = ['주문ID', '주문일시', '고객ID', '결제금액', '결제확인일시'];
    const rows = report.orders.map((o) => [
      o.orderId,
      o.orderDate,
      o.customerId,
      o.total.toString(),
      o.paidAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `settlement_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    setIsExcelLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
      const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      const response = await fetch(`${apiBase}/admin/settlement/download?${params.toString()}`, {
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (!response.ok) throw new Error('Excel export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `settlement_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('엑셀 다운로드에 실패했습니다');
    } finally {
      setIsExcelLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getSortedOrders = () => {
    if (!report) return [];
    return [...report.orders].sort((a, b) => {
      let aValue: number;
      let bValue: number;
      switch (sortField) {
        case 'orderDate':
          aValue = new Date(a.orderDate).getTime();
          bValue = new Date(b.orderDate).getTime();
          break;
        case 'total':
          aValue = a.total;
          bValue = b.total;
          break;
        case 'paidAt':
          aValue = new Date(a.paidAt).getTime();
          bValue = new Date(b.paidAt).getTime();
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
    });
  };

  const getPaginatedOrders = () => {
    const sorted = getSortedOrders();
    return sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  };

  const getTotalPages = () => (!report ? 1 : Math.ceil(report.orders.length / pageSize));

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const summaryCards = report
    ? [
        {
          label: '총 주문 건수',
          value: `${report.summary.totalOrders}건`,
          icon: ShoppingCart,
          iconClass: 'bg-blue-50 text-blue-500',
          valueClass: 'text-gray-900',
        },
        {
          label: '총 매출액',
          value: formatCurrency(report.summary.totalRevenue),
          icon: DollarSign,
          iconClass: 'bg-pink-50 text-[#FF4D8D]',
          valueClass: 'text-[#FF4D8D]',
        },
        {
          label: '평균 주문액',
          value: formatCurrency(report.summary.avgOrderValue),
          icon: TrendingUp,
          iconClass: 'bg-green-50 text-green-500',
          valueClass: 'text-gray-900',
        },
        {
          label: '배송비 총액',
          value: formatCurrency(report.summary.totalShippingFee),
          icon: Package,
          iconClass: 'bg-orange-50 text-orange-500',
          valueClass: 'text-gray-900',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#FF4D8D]" />
            정산 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            입금 확인된 주문의 정산 리포트를 조회하고 다운로드하세요
          </p>
        </div>
      </div>

      {/* Date Range + Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">조회 기간 선택</h3>
        <div className="flex flex-col md:flex-row gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Input
              label="시작일"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input
              label="종료일"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
            />
          </div>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isLoading || !fromDate || !toDate}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLoading ? '조회 중...' : '조회하기'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!report}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!fromDate || !toDate || isExcelLoading}
          >
            {isExcelLoading ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            {isExcelLoading ? '다운로드 중...' : '엑셀'}
          </Button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(({ label, value, icon: Icon, iconClass, valueClass }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className={`inline-flex p-2.5 rounded-lg mb-3 ${iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-sm text-blue-600">입금 확인된 주문만 포함됩니다</p>
          </div>

          {/* Chart */}
          {report.dailyRevenue && report.dailyRevenue.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-5">일별 매출 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    style={{ fontSize: '11px', fill: '#9ca3af' }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    style={{ fontSize: '11px', fill: '#9ca3af' }}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), '매출액']}
                    labelFormatter={(label) => `날짜: ${label}`}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #f3f4f6',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#FF4D8D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Orders Table */}
          {report.orders.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">결산 주문 목록</h3>
                  <span className="text-sm text-gray-400">총 {report.orders.length}건</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th
                          className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('orderDate')}
                        >
                          주문일 <SortIcon field="orderDate" />
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          주문번호
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          고객
                        </th>
                        <th
                          className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('total')}
                        >
                          금액 <SortIcon field="total" />
                        </th>
                        <th
                          className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('paidAt')}
                        >
                          입금일 <SortIcon field="paidAt" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {getPaginatedOrders().map((order) => (
                        <tr key={order.orderId} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {formatDate(order.orderDate)}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-xs text-gray-700 font-mono">{order.orderId}</span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700">{order.customerId}</span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(order.total)}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {formatDate(order.paidAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {getTotalPages() > 1 && (
                <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-5 py-3.5">
                  <span className="text-sm text-gray-500">
                    총 {report.orders.length}건 중 {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, report.orders.length)}건 표시
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {Array.from({ length: getTotalPages() }, (_, i) => i + 1)
                      .filter((p) => {
                        if (getTotalPages() <= 7) return true;
                        if (p === 1 || p === getTotalPages()) return true;
                        return Math.abs(p - currentPage) <= 1;
                      })
                      .map((p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) {
                          return (
                            <span key={`ellipsis-${p}`} className="px-1 text-gray-400 text-sm">
                              ...
                            </span>
                          );
                        }
                        return (
                          <Button
                            key={p}
                            variant={currentPage === p ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </Button>
                        );
                      })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(getTotalPages(), p + 1))}
                      disabled={currentPage === getTotalPages()}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
              <Inbox className="w-14 h-14 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-gray-500 mb-1">
                선택한 기간에 입금 확인된 주문이 없습니다
              </h3>
              <p className="text-sm text-gray-400">다른 기간을 선택해주세요</p>
            </div>
          )}
        </>
      )}

      {!report && !isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-500 mb-1">정산 리포트를 조회해주세요</h3>
          <p className="text-sm text-gray-400">조회 기간을 선택하고 조회하기 버튼을 눌러주세요</p>
        </div>
      )}
    </div>
  );
}
