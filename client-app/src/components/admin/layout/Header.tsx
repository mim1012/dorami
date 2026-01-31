'use client';

import { Bell, Search } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 lg:ml-64 shadow-sm">
            {/* Left: Breadcrumbs / Title */}
            <div className="ml-14 lg:ml-0">
                <h2 className="text-base md:text-lg font-semibold text-primary-text">대시보드</h2>
                <p className="text-xs text-secondary-text hidden sm:block">라이브 커머스 현황 개요</p>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 md:gap-4">
                {/* Search Bar */}
                <div className="relative hidden md:block">
                    <Search className="w-4 h-4 text-secondary-text absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="검색..."
                        className="bg-content-bg border border-gray-300 rounded-full pl-10 pr-4 py-1.5 text-sm text-primary-text focus:outline-none focus:border-hot-pink/50 transition-colors w-48 lg:w-64"
                    />
                </div>

                {/* Notifications */}
                <button className="relative p-2 text-secondary-text hover:text-primary-text transition-colors rounded-full hover:bg-gray-100">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-hot-pink rounded-full border-2 border-white" />
                </button>

                {/* Profile */}
                <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-gray-200">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-primary-text">관리자</p>
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
