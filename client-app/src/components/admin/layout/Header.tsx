'use client';

import { Bell, Search } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-16 bg-primary-black/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-40 ml-64">
            {/* Left: Breadcrumbs / Title */}
            <div>
                <h2 className="text-lg font-semibold text-white">대시보드</h2>
                <p className="text-xs text-secondary-text">라이브 커머스 현황 개요</p>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
                {/* Search Bar */}
                <div className="relative hidden md:block">
                    <Search className="w-4 h-4 text-secondary-text absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="검색..."
                        className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-hot-pink/50 transition-colors w-64"
                    />
                </div>

                {/* Notifications */}
                <button className="relative p-2 text-secondary-text hover:text-white transition-colors rounded-full hover:bg-white/5">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-hot-pink rounded-full border border-primary-black" />
                </button>

                {/* Profile */}
                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-white">관리자</p>
                        <p className="text-xs text-secondary-text">슈퍼 어드민</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hot-pink to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                        AD
                    </div>
                </div>
            </div>
        </header>
    );
}
