'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrderById } from '@/lib/api/orders';
import { Order, OrderStatus } from '@/lib/types/order';
import { CheckCircle, Clock, Package, Truck, Home, Copy, Check } from 'lucide-react';

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      const data = await getOrderById(orderId);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAccountNumber = async () => {
    if (order?.bankTransferInfo) {
      await navigator.clipboard.writeText(order.bankTransferInfo.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAccountNumber = (accountNumber: string) => {
    return accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const getStatusSteps = () => {
    const steps = [
      { label: 'Order Created', icon: CheckCircle, status: 'ORDER_CREATED' },
      { label: 'Payment Pending', icon: Clock, status: 'PENDING_PAYMENT' },
      { label: 'Payment Confirmed', icon: CheckCircle, status: 'PAYMENT_CONFIRMED' },
      { label: 'Shipped', icon: Truck, status: 'SHIPPED' },
      { label: 'Delivered', icon: Home, status: 'DELIVERED' },
    ];

    const statusOrder: OrderStatus[] = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAYMENT_CONFIRMED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const currentIndex = statusOrder.indexOf(order!.status);

    return steps.map((step, index) => {
      if (index === 0) return { ...step, completed: true, current: false };
      if (index === 1) return { ...step, completed: currentIndex >= 0, current: currentIndex === 0 };
      if (index === 2) return { ...step, completed: currentIndex >= 1, current: currentIndex === 1 };
      if (index === 3) return { ...step, completed: currentIndex >= 2, current: currentIndex === 2 };
      if (index === 4) return { ...step, completed: currentIndex >= 3, current: currentIndex === 3 };
      return { ...step, completed: false, current: false };
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'Unable to load order details'}</p>
            <button
              onClick={() => router.push('/orders')}
              className="px-6 py-2 bg-info text-white rounded-lg hover:bg-info/80"
            >
              View All Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        <div className="bg-success-bg border border-success/20 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-success mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-primary-text">Order Placed Successfully!</h1>
              <p className="text-success mt-1">
                Order ID: {order.id} • {new Date(order.createdAt).toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Status</h2>
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200"></div>
            <div className="relative flex justify-between">
              {statusSteps.map((step, index) => (
                <div key={index} className="flex flex-col items-center" style={{ flex: 1 }}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      step.completed
                        ? 'bg-success border-success'
                        : step.current
                        ? 'bg-pink-500 border-pink-500 animate-pulse'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <step.icon
                      className={`w-5 h-5 ${
                        step.completed || step.current ? 'text-white' : 'text-gray-400'
                      }`}
                    />
                  </div>
                  <p
                    className={`text-xs mt-2 text-center ${
                      step.completed || step.current ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bank Transfer Instructions */}
        {order.bankTransferInfo && (
          <div className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-lg shadow-md p-6 mb-6 border-2 border-pink-200">
            <h2 className="text-xl font-semibold text-pink-900 mb-4">
              💳 Bank Transfer Instructions
            </h2>
            <div className="bg-white rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Bank Name</span>
                <span className="font-semibold text-gray-900">
                  {order.bankTransferInfo.bankName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-gray-900">
                    {formatAccountNumber(order.bankTransferInfo.accountNumber)}
                  </span>
                  <button
                    onClick={copyAccountNumber}
                    className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Account Holder</span>
                <span className="font-semibold text-gray-900">
                  {order.bankTransferInfo.accountHolder}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-gray-900 font-semibold">Transfer Amount</span>
                <span className="text-2xl font-bold text-pink-600">
                  {formatPrice(order.bankTransferInfo.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Depositor Name</span>
                <span className="font-semibold text-gray-900">
                  {order.bankTransferInfo.depositorName}
                </span>
              </div>
            </div>
            <div className="mt-4 bg-warning-bg border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-primary-text">
                ⚠️ <strong>Important:</strong> Please use your registered depositor name (
                {order.bankTransferInfo.depositorName}) for transfer verification.
              </p>
            </div>
            {copied && (
              <div className="mt-3 text-center text-sm text-success font-medium">
                ✓ Account number copied to clipboard!
              </div>
            )}
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Items</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-600">
                    Quantity: {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping Fee</span>
              <span>{formatPrice(order.shippingFee)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push('/orders')}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            View My Orders
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-info text-white rounded-lg hover:bg-info/80 font-medium transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
