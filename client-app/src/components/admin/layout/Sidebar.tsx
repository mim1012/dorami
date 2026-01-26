'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Radio,
    ShoppingBag,
    Package,
    Users,
    Settings,
    LogOut
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

    return (
        <aside className="w-64 bg-primary-black border-r border-white/10 flex flex-col h-screen fixed left-0 top-0 z-50">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-hot-pink rounded-full flex items-center justify-center">
                        <Radio className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight">
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
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-hot-pink/10 text-hot-pink'
                                : 'text-secondary-text hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon
                                className={`w-5 h-5 transition-colors ${isActive ? 'text-hot-pink' : 'text-secondary-text group-hover:text-white'
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
                <button className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-secondary-text hover:bg-white/5 hover:text-white transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">로그아웃</span>
                </button>
            </div>
        </aside>
    );
}
