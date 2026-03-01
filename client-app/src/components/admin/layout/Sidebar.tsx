'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import {
  LayoutDashboard,
  Radio,
  ShoppingBag,
  Package,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  BarChart3,
  Calendar,
} from 'lucide-react';

const menuItems = [
  {
    name: '대시보드',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
    aliases: ['/admin/overview'],
    badgeKey: undefined,
  },
  {
    name: '라이브 관리',
    icon: Calendar,
    href: '/admin/broadcasts',
    aliases: ['/admin/live-management'],
    badgeKey: undefined,
  },
  {
    name: '상품관리',
    icon: ShoppingBag,
    href: '/admin/products',
    aliases: ['/admin/product-management'],
    badgeKey: undefined,
  },
  {
    name: '주문관리',
    icon: Package,
    href: '/admin/orders',
    aliases: ['/admin/order-management'],
    badgeKey: undefined,
  },
  {
    name: '사용자관리',
    icon: Users,
    href: '/admin/users',
    aliases: ['/admin/customers'],
    badgeKey: undefined,
  },
  {
    name: '분석',
    icon: BarChart3,
    href: '/admin/analystic',
    aliases: ['/admin/analytics'],
    badgeKey: undefined,
  },
  { name: '설정', icon: Settings, href: '/admin/settings', badgeKey: undefined },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const { data } = await apiClient.get<{ pendingPayments?: { value: number } }>(
          '/admin/dashboard/stats',
        );
        setPendingPaymentsCount(data?.pendingPayments?.value || 0);
      } catch (err) {
        console.error('Failed to fetch pending payments:', err);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-[100dvh] w-[240px] bg-white border-r border-gray-200 flex flex-col z-50
          transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 sm:px-6 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-400 flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">
                Doremi<span className="text-pink-500">Live</span>
              </h1>
              <p className="text-xs text-gray-500 leading-tight">Admin</p>
            </div>
          </Link>
        </div>

        {/* Home Link */}
        <div className="px-3 pt-4 pb-3 border-b border-gray-200">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-pink-50 hover:text-pink-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
            <span className="text-sm font-medium">홈화면으로</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + '/') ||
                (item.aliases?.some((alias) => pathname === alias || pathname.startsWith(alias + '/')) ??
                  false) ||
                (item.href === '/admin/dashboard' && pathname === '/admin');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive ? 'bg-pink-50 text-pink-500' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                      {item.name}
                    </span>
                    {item.badgeKey === 'pendingPayments' && pendingPaymentsCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-pink-500 rounded-full">
                        {pendingPaymentsCount > 99 ? '99+' : pendingPaymentsCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-5 h-5" strokeWidth={2} />
            <span className="text-sm font-medium">로그아웃</span>
          </button>
          <p className="text-xs text-gray-400 text-center">v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
