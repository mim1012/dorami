'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Radio,
  Megaphone,
  Bell,
  ShoppingCart,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  BellRing,
  BellOff,
} from 'lucide-react';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { apiClient } from '@/lib/api/client';
import { formatPrice } from '@/lib/utils/price';
import { usePushNotification } from '@/lib/hooks/use-push-notification';

type AlertTab = '전체' | '주문' | '라이브' | '공지';

interface Notification {
  id: string;
  type: 'order' | 'live' | 'notice' | 'stock';
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: 'cart' | 'truck' | 'check' | 'live' | 'megaphone' | 'clock' | 'alert';
  link?: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AlertTab>('전체');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    permission,
    isSubscribed,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
  } = usePushNotification();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Try to fetch real orders for order notifications
      const orderRes = await apiClient.get<any>('/orders/my').catch(() => null);
      const orders = orderRes?.data?.orders || orderRes?.data || [];

      const orderNotifs: Notification[] = Array.isArray(orders)
        ? orders.slice(0, 5).map((order: any) => ({
            id: `order-${order.id}`,
            type: 'order' as const,
            title: getOrderTitle(order.status),
            message: `주문번호 ${order.orderNumber || order.id?.slice(0, 8)} · ${formatPrice(order.totalAmount || 0)}`,
            time: formatTime(order.updatedAt || order.createdAt),
            read: order.status === 'DELIVERED',
            icon: getOrderIcon(order.status),
            link: `/orders/${order.id}`,
          }))
        : [];

      // Static notifications for live (until backend supports per-user notification feed)
      const staticNotifs: Notification[] = [
        {
          id: 'live-1',
          type: 'live',
          title: '라이브 방송 알림',
          message: '곧 새로운 라이브 방송이 시작됩니다! 놓치지 마세요.',
          time: '오늘',
          read: false,
          icon: 'live',
          link: '/live',
        },
      ];

      // Fetch notices from API
      let noticeNotifs: Notification[] = [];
      try {
        const noticeRes = await apiClient.get<any>('/admin/notices').catch(() => null);
        const noticesData = noticeRes?.data?.notices || noticeRes?.data || [];
        if (Array.isArray(noticesData) && noticesData.length > 0) {
          noticeNotifs = noticesData.slice(0, 5).map((notice: any) => ({
            id: `notice-${notice.id}`,
            type: 'notice' as const,
            title: notice.title || '서비스 공지',
            message: notice.content || notice.message || notice.noticeText || '',
            time: formatTime(notice.updatedAt || notice.createdAt),
            read: false,
            icon: 'megaphone' as const,
          }));
        }
      } catch {
        // silent fail
      }

      // Fallback to static notice if no API notices
      if (noticeNotifs.length === 0) {
        noticeNotifs = [
          {
            id: 'notice-1',
            type: 'notice',
            title: '서비스 공지',
            message: 'DoReMi 라이브 커머스에 오신 것을 환영합니다!',
            time: '오늘',
            read: true,
            icon: 'megaphone',
          },
        ];
      }

      setNotifications([...orderNotifs, ...staticNotifs, ...noticeNotifs]);
    } catch {
      // If all fetches fail, show default notifications
      setNotifications([
        {
          id: 'notice-welcome',
          type: 'notice',
          title: '환영합니다!',
          message: 'Doremi 라이브 커머스에 가입해 주셔서 감사합니다.',
          time: '오늘',
          read: false,
          icon: 'megaphone',
        },
        {
          id: 'live-upcoming',
          type: 'live',
          title: '라이브 방송 예정',
          message: '새로운 라이브 방송이 곧 시작됩니다. 알림을 받아보세요!',
          time: '오늘',
          read: false,
          icon: 'live',
          link: '/live',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { label: AlertTab; icon: typeof Bell }[] = [
    { label: '전체', icon: Bell },
    { label: '주문', icon: Package },
    { label: '라이브', icon: Radio },
    { label: '공지', icon: Megaphone },
  ];

  const tabTypeMap: Record<AlertTab, string | null> = {
    전체: null,
    주문: 'order',
    라이브: 'live',
    공지: 'notice',
  };

  const filtered =
    activeTab === '전체'
      ? notifications
      : notifications.filter((n) => n.type === tabTypeMap[activeTab]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const IconComponent = ({ icon }: { icon: Notification['icon'] }) => {
    const cls = 'w-5 h-5';
    switch (icon) {
      case 'cart':
        return <ShoppingCart className={`${cls} text-hot-pink`} />;
      case 'truck':
        return <Truck className={`${cls} text-info`} />;
      case 'check':
        return <CheckCircle className={`${cls} text-success`} />;
      case 'live':
        return <Radio className={`${cls} text-hot-pink`} />;
      case 'megaphone':
        return <Megaphone className={`${cls} text-warning`} />;
      case 'clock':
        return <Clock className={`${cls} text-secondary-text`} />;
      case 'alert':
        return <AlertTriangle className={`${cls} text-error`} />;
      default:
        return <Bell className={`${cls} text-secondary-text`} />;
    }
  };

  return (
    <>
      <main className="min-h-screen bg-primary-black pb-bottom-nav">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary-black border-b border-border-color">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-content-bg transition-colors"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5 text-primary-text" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-primary-text">알림</h1>
            </div>
            {unreadCount > 0 && (
              <span className="bg-hot-pink text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex px-4 gap-1">
            {tabs.map(({ label, icon: TabIcon }) => (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
                  activeTab === label
                    ? 'bg-content-bg text-hot-pink border-b-2 border-hot-pink'
                    : 'text-secondary-text hover:text-primary-text'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Push Subscription Status */}
        {permission !== 'unsupported' && (
          <div className="px-4 pt-3">
            {isSubscribed ? (
              <div className="flex items-center justify-between p-3 bg-content-bg rounded-xl border border-border-color">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-hot-pink" />
                  <span className="text-sm text-primary-text font-medium">푸시 알림 수신 중</span>
                </div>
                <button
                  onClick={unsubscribe}
                  disabled={pushLoading}
                  className="text-xs text-secondary-text hover:text-error transition-colors font-medium disabled:opacity-50"
                >
                  해제
                </button>
              </div>
            ) : permission !== 'denied' ? (
              <button
                onClick={subscribe}
                disabled={pushLoading}
                className="w-full flex items-center justify-center gap-2 p-3 bg-hot-pink/10 border border-hot-pink/20 rounded-xl text-sm font-bold text-hot-pink active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <BellOff className="w-4 h-4" />
                {pushLoading ? '설정 중...' : '푸시 알림 켜기'}
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-content-bg rounded-xl border border-border-color">
                <BellOff className="w-4 h-4 text-secondary-text" />
                <span className="text-sm text-secondary-text">
                  브라우저 알림이 차단되었습니다. 설정에서 허용해주세요.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Bell className="w-12 h-12 text-secondary-text/40 mb-3" />
              <p className="text-secondary-text font-medium">알림이 없습니다</p>
              <p className="text-secondary-text/60 text-sm mt-1">
                새로운 소식이 있으면 알려드릴게요
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => notif.link && router.push(notif.link)}
                  className={`w-full text-left flex items-start gap-3 p-4 rounded-xl transition-colors ${
                    notif.read ? 'bg-content-bg/50' : 'bg-content-bg border border-hot-pink/10'
                  } ${notif.link ? 'hover:bg-content-bg active:scale-[0.99]' : ''}`}
                >
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      notif.read ? 'bg-primary-black' : 'bg-hot-pink/10'
                    }`}
                  >
                    <IconComponent icon={notif.icon} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-semibold truncate ${
                          notif.read ? 'text-secondary-text' : 'text-primary-text'
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-hot-pink rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-secondary-text mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-xs text-secondary-text/60 mt-1.5">{notif.time}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomTabBar />
    </>
  );
}

function getOrderTitle(status: string): string {
  switch (status) {
    case 'PENDING':
      return '주문 접수';
    case 'DEPOSIT_WAITING':
      return '입금 대기 중';
    case 'DEPOSIT_CONFIRMED':
      return '입금 확인 완료';
    case 'PREPARING':
      return '상품 준비 중';
    case 'SHIPPING':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    case 'CANCELLED':
      return '주문 취소됨';
    default:
      return '주문 업데이트';
  }
}

function getOrderIcon(status: string): Notification['icon'] {
  switch (status) {
    case 'PENDING':
    case 'DEPOSIT_WAITING':
      return 'clock';
    case 'DEPOSIT_CONFIRMED':
    case 'PREPARING':
      return 'cart';
    case 'SHIPPING':
      return 'truck';
    case 'DELIVERED':
      return 'check';
    case 'CANCELLED':
      return 'alert';
    default:
      return 'cart';
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
