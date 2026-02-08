'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Display, Body, Heading2, Caption } from '@/components/common/Typography';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

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
  dateRange: {
    from: string;
    to: string;
  };
}

type SortField = 'orderDate' | 'total' | 'paidAt';
type SortOrder = 'asc' | 'desc';

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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Sorting
  const [sortField, setSortField] = useState<SortField>('paidAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const validateDateRange = (): string | null => {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from > to) {
      return '시작일은 종료일보다 이전이어야 합니다';
    }

    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > oneYear) {
      return '최대 조회 기간은 1년입니다';
    }

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
      console.error('Failed to generate settlement report:', err);
      setError(err.message || '리포트 생성 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
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
      let aValue: any;
      let bValue: any;

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

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const getPaginatedOrders = () => {
    const sorted = getSortedOrders();
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  };

  const getTotalPages = () => {
    if (!report) return 1;
    return Math.ceil(report.orders.length / pageSize);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatChartDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">정산 관리</Display>
          <Body className="text-secondary-text">입금 확인된 주문의 정산 리포트를 조회하고 다운로드하세요</Body>
        </div>

        <div className="bg-content-bg rounded-button p-6 mb-6">
          <Heading2 className="text-hot-pink mb-4">조회 기간 선택</Heading2>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Input
                label="시작일"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                fullWidth
              />
            </div>

            <div className="flex-1">
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
              className="md:mb-0"
            >
              {isLoading ? '조회 중...' : '조회하기'}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-error/10 border border-error rounded-button">
              <Caption className="text-error">{error}</Caption>
            </div>
          )}
        </div>

        {report && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-content-bg rounded-button p-6">
                <Caption className="text-secondary-text mb-2">총 주문 건수</Caption>
                <Heading2 className="text-primary-text">{report.summary.totalOrders}건</Heading2>
              </div>

              <div className="bg-content-bg rounded-button p-6">
                <Caption className="text-secondary-text mb-2">총 매출액</Caption>
                <Heading2 className="text-hot-pink">{formatCurrency(report.summary.totalRevenue)}</Heading2>
              </div>

              <div className="bg-content-bg rounded-button p-6">
                <Caption className="text-secondary-text mb-2">평균 주문액</Caption>
                <Heading2 className="text-primary-text">{formatCurrency(report.summary.avgOrderValue)}</Heading2>
              </div>

              <div className="bg-content-bg rounded-button p-6">
                <Caption className="text-secondary-text mb-2">배송비 총액</Caption>
                <Heading2 className="text-primary-text">{formatCurrency(report.summary.totalShippingFee)}</Heading2>
              </div>
            </div>

            <div className="mb-6 p-3 bg-info/10 border border-info rounded-button">
              <Caption className="text-info">입금 확인된 주문만 포함됩니다</Caption>
            </div>

            {report.dailyRevenue && report.dailyRevenue.length > 0 && (
              <div className="bg-content-bg rounded-button p-6 mb-6">
                <Heading2 className="text-hot-pink mb-4">일별 매출 추이</Heading2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${value}`}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => value !== undefined ? [formatCurrency(value), '매출액'] : ['-', '매출액']}
                      labelFormatter={(label) => `날짜: ${label}`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #FF1B8D',
                        borderRadius: '8px',
                        padding: '8px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#FF1B8D" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <Caption className="text-secondary-text text-center mt-2">
                  🖱️ 막대에 마우스를 올리면 상세 정보를 확인할 수 있습니다
                </Caption>
              </div>
            )}

            {report.orders.length > 0 ? (
              <>
                <div className="bg-white rounded-button border border-content-bg overflow-x-auto mb-4">
                  <table className="min-w-full">
                    <thead className="bg-content-bg">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider cursor-pointer hover:bg-white/50"
                          onClick={() => handleSort('orderDate')}
                        >
                          주문일 <SortIcon field="orderDate" />
                        </th>
                        <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                          주문번호
                        </th>
                        <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                          고객
                        </th>
                        <th
                          className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider cursor-pointer hover:bg-white/50"
                          onClick={() => handleSort('total')}
                        >
                          금액 <SortIcon field="total" />
                        </th>
                        <th
                          className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider cursor-pointer hover:bg-white/50"
                          onClick={() => handleSort('paidAt')}
                        >
                          입금일 <SortIcon field="paidAt" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-content-bg">
                      {getPaginatedOrders().map((order) => (
                        <tr key={order.orderId} className="hover:bg-content-bg/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Body className="text-primary-text">{formatDate(order.orderDate)}</Body>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Body className="text-primary-text font-mono text-caption">{order.orderId}</Body>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Body className="text-primary-text">{order.customerId}</Body>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Body className="text-primary-text font-medium">{formatCurrency(order.total)}</Body>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Body className="text-primary-text">{formatDate(order.paidAt)}</Body>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {getTotalPages() > 1 && (
                  <div className="flex items-center justify-between bg-content-bg rounded-button px-6 py-4">
                    <Caption className="text-secondary-text">
                      총 {report.orders.length}건 중 {(currentPage - 1) * pageSize + 1}-
                      {Math.min(currentPage * pageSize, report.orders.length)}건 표시
                    </Caption>

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
                        .filter((page) => {
                          if (getTotalPages() <= 7) return true;
                          if (page === 1 || page === getTotalPages()) return true;
                          return Math.abs(page - currentPage) <= 1;
                        })
                        .map((page, idx, arr) => {
                          if (idx > 0 && page - arr[idx - 1] > 1) {
                            return (
                              <span key={`ellipsis-${page}`} className="px-2">
                                ...
                              </span>
                            );
                          }
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
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
              <div className="bg-content-bg rounded-button p-12 text-center">
                <div className="text-6xl mb-4">📭</div>
                <Heading2 className="text-secondary-text mb-2">선택한 기간에 입금 확인된 주문이 없습니다</Heading2>
                <Body className="text-secondary-text">다른 기간을 선택해주세요</Body>
              </div>
            )}
          </>
        )}

        {!report && !isLoading && (
          <div className="bg-content-bg rounded-button p-12 text-center">
            <div className="w-16 h-16 mb-4 rounded-xl bg-gray-100 flex items-center justify-center"><svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
            <Heading2 className="text-secondary-text mb-2">정산 리포트를 조회해주세요</Heading2>
            <Body className="text-secondary-text">조회 기간을 선택하고 조회하기 버튼을 눌러주세요</Body>
          </div>
        )}
      </div>
    </div>
  );
}
