'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
    LayoutDashboard,
    Radio,
    ShoppingBag,
    Package,
    Users,
    Settings,
    LogOut,
    Menu,
    X
} from 'lucide-react';

const menuItems = [
    { name: '대시보드', icon: LayoutDashboard, href: '/admin' },
    { name: '방송 관리', icon: Radio, href: '/admin/broadcasts' },
    { name: '상품 관리', icon: ShoppingBag, href: '/admin/products' },
    { name: '주문 관리', icon: Package, href: '/admin/orders' },
    { name: '사용자 관리', icon: Users, href: '/admin/users' },
    { name: '설정', icon: Settings, href: '/admin/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            <aside className={`
                w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-lg
                transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-hot-pink rounded-full flex items-center justify-center">
                            <Radio className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-primary-text tracking-tight">
                            Dorami<span className="text-hot-pink">Live</span>
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isActive
                                    ? 'bg-hot-pink/10 text-hot-pink'
                                    : 'text-secondary-text hover:bg-gray-100 hover:text-primary-text'
                                    }`}
                            >
                                <item.icon
                                    className={`w-5 h-5 transition-colors ${isActive ? 'text-hot-pink' : 'text-secondary-text group-hover:text-primary-text'
                                        }`}
                                />
                                <span className="font-medium">{item.name}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-hot-pink shadow-[0_0_8px_rgba(255,0,122,0.8)]" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer / User Profile */}
                <div className="p-4 border-t border-white/10">
                    <button className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-secondary-text hover:bg-gray-100 hover:text-primary-text transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">로그아웃</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
