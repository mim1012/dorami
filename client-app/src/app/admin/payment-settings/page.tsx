'use client';

import { useState } from 'react';
import { Check, CreditCard, Globe, Plus, Trash2, X } from 'lucide-react';

interface PaymentItem {
  id: number;
  type: 'stripe' | 'paypal' | 'alipay' | 'wechat';
  accountName: string;
  accountId: string;
  currency: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

const initialPayments: PaymentItem[] = [
  {
    id: 1,
    type: 'stripe',
    accountName: 'Stripe Korea',
    accountId: 'acct_1234567890',
    currency: 'USD',
    status: 'active',
    createdAt: '2026-01-15',
  },
  {
    id: 2,
    type: 'paypal',
    accountName: 'PayPal Business',
    accountId: 'paypal@doremi.com',
    currency: 'USD',
    status: 'active',
    createdAt: '2026-01-20',
  },
  {
    id: 3,
    type: 'alipay',
    accountName: 'Alipay International',
    accountId: '2088123456789012',
    currency: 'CNY',
    status: 'inactive',
    createdAt: '2026-02-01',
  },
];

const paymentTypeLabels: Record<PaymentItem['type'], string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
};

const paymentTypeStyles: Record<PaymentItem['type'], string> = {
  stripe: 'bg-purple-100 text-purple-700 border-purple-200',
  paypal: 'bg-blue-100 text-blue-700 border-blue-200',
  alipay: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  wechat: 'bg-green-100 text-green-700 border-green-200',
};

const statusStyle = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-700',
};

const statusLabel = {
  active: '활성',
  inactive: '비활성',
};

export default function AdminPaymentSettingsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [newPayment, setNewPayment] = useState({
    type: 'stripe' as PaymentItem['type'],
    accountName: '',
    accountId: '',
    currency: 'USD',
    status: 'active' as 'active' | 'inactive',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payment: PaymentItem = {
      id: payments.length + 1,
      ...newPayment,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setPayments([...payments, payment]);
    setNewPayment({
      type: 'stripe',
      accountName: '',
      accountId: '',
      currency: 'USD',
      status: 'active',
    });
    setIsModalOpen(false);
  };

  const handleDelete = (id: number) => {
    setPayments((prev) => prev.filter((payment) => payment.id !== id));
    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">해외 결제 설정</h1>
          <p className="mt-1 text-sm text-gray-500">해외 결제 수단을 등록하고 관리하세요</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF4D8D] text-white font-semibold hover:bg-[#FF6BA0]"
        >
          <Plus className="w-4 h-4" />
          결제 수단 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">전체 결제수단</p>
          <p className="text-2xl font-bold mt-1">{payments.length}개</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">활성 상태</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">
            {payments.filter((payment) => payment.status === 'active').length}개
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">비활성 상태</p>
          <p className="text-2xl font-bold mt-1 text-gray-600">
            {payments.filter((payment) => payment.status === 'inactive').length}개
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">지원 통화</p>
          <p className="text-2xl font-bold mt-1">
            {new Set(payments.map((payment) => payment.currency)).size}개
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  결제 수단
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">계정명</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">계정 ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">통화</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">상태</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">등록일</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900">#{payment.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border ${paymentTypeStyles[payment.type]}`}
                    >
                      <CreditCard className="w-4 h-4" />
                      {paymentTypeLabels[payment.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.accountName}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono">{payment.accountId}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.currency}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusStyle[payment.status]}`}
                    >
                      {statusLabel[payment.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{payment.createdAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setDeleteTargetId(payment.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 text-sm font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payments.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Globe className="w-10 h-10 mx-auto text-gray-400" />
          <p className="mt-4 text-sm text-gray-500">등록된 결제 수단이 없습니다.</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">결제 수단 추가</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">결제 수단</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={newPayment.type}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, type: e.target.value as PaymentItem['type'] })
                  }
                >
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="alipay">Alipay</option>
                  <option value="wechat">WeChat Pay</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">계정명</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={newPayment.accountName}
                  onChange={(e) => setNewPayment({ ...newPayment, accountName: e.target.value })}
                  placeholder="예: Stripe Korea"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">계정 ID</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={newPayment.accountId}
                  onChange={(e) => setNewPayment({ ...newPayment, accountId: e.target.value })}
                  placeholder="예: acct_1234567890"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">통화</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={newPayment.currency}
                  onChange={(e) => setNewPayment({ ...newPayment, currency: e.target.value })}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="JPY">JPY</option>
                  <option value="CNY">CNY</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={newPayment.status === 'active'}
                    onChange={(e) =>
                      setNewPayment({
                        ...newPayment,
                        status: e.target.checked ? 'active' : 'inactive',
                      })
                    }
                  />
                  활성화
                </label>
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="w-4 h-4" />
                  추가 후 바로 적용
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#FF4D8D] text-white rounded-lg hover:bg-[#FF6BA0]"
                >
                  추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 수단 삭제</h2>
            <p className="text-sm text-gray-600 mb-5">정말 이 결제 수단을 삭제하시겠습니까?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTargetId)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
