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
} from 'lucide-react';

const menuItems = [
  { name: '대시보드', icon: LayoutDashboard, href: '/admin/dashboard' },
  { name: '방송 관리', icon: Radio, href: '/admin/broadcasts' },
  { name: '상품 관리', icon: ShoppingBag, href: '/admin/products' },
  { name: '주문 관리', icon: Package, href: '/admin/orders', badgeKey: 'pendingPayments' },
  { name: '사용자 관리', icon: Users, href: '/admin/users' },
  { name: '설정', icon: Settings, href: '/admin/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  // Fetch pending payments count
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile Menu Button (Hamburger) */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-content-bg border border-gray-300 rounded-lg text-primary-text hover:bg-gray-100 transition-colors"
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
                w-64 bg-white dark:bg-[#0A0A0A] border-r border-gray-200 dark:border-[#2A2A2A] flex flex-col h-screen fixed left-0 top-0 z-50 shadow-lg
                transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 bg-hot-pink rounded-full flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Doremi<span className="text-hot-pink">Live</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto bg-white dark:bg-[#0A0A0A]">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-hot-pink/10 text-hot-pink'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-hot-pink'
                      : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'
                  }`}
                />
                <span className="font-medium">{item.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  {item.badgeKey === 'pendingPayments' && pendingPaymentsCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-warning rounded-full">
                      {pendingPaymentsCount > 99 ? '99+' : pendingPaymentsCount}
                    </span>
                  )}
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-hot-pink shadow-[0_0_8px_rgba(255,0,122,0.8)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="p-4 border-t border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  );
}
