'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Display, Body, Heading2, Caption } from '@/components/common/Typography';

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

interface SettlementReport {
  summary: SettlementSummary;
  orders: SettlementOrder[];
  dateRange: {
    from: string;
    to: string;
  };
}

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
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownloadExcel = async () => {
    if (!report) return;

    setIsDownloading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/settlement/download?from=${fromDate}&to=${toDate}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Excel download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement_${fromDate}_${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download Excel:', err);
      alert('Excel 다운로드 중 오류가 발생했습니다');
    } finally {
      setIsDownloading(false);
    }
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

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">📊 정산 관리</Display>
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
              <Caption className="text-info">💡 입금 확인된 주문만 포함됩니다</Caption>
            </div>

            <div className="mb-6 flex justify-end">
              <Button
                variant="primary"
                onClick={handleDownloadExcel}
                disabled={isDownloading}
              >
                {isDownloading ? 'Excel 다운로드 중...' : '📥 Excel 다운로드'}
              </Button>
            </div>

            {report.orders.length > 0 ? (
              <div className="bg-white rounded-button border border-content-bg overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-content-bg">
                    <tr>
                      <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                        주문일
                      </th>
                      <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                        주문번호
                      </th>
                      <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                        고객
                      </th>
                      <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                        금액
                      </th>
                      <th className="px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider">
                        입금일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-content-bg">
                    {report.orders.map((order) => (
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

                <div className="px-6 py-4 bg-content-bg border-t border-gray-200">
                  <Caption className="text-secondary-text">총 {report.orders.length}건</Caption>
                </div>
              </div>
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
            <div className="text-6xl mb-4">📊</div>
            <Heading2 className="text-secondary-text mb-2">정산 리포트를 조회해주세요</Heading2>
            <Body className="text-secondary-text">조회 기간을 선택하고 조회하기 버튼을 눌러주세요</Body>
          </div>
        )}
      </div>
    </div>
  );
}
