'use client';

import { ShoppingBag, Bell, Search } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#FF4D8D] to-[#B084CC] flex items-center justify-center">
              <span className="text-white font-bold text-sm md:text-base">D</span>
            </div>
            <h1 className="font-bold text-lg md:text-xl bg-gradient-to-r from-[#FF4D8D] to-[#B084CC] bg-clip-text text-transparent">
              도레미
            </h1>
          </Link>

          {/* Icons */}
          <div className="flex items-center gap-3 md:gap-4">
            <button className="p-2 hover:bg-gray-50 rounded-full transition-colors relative">
              <Bell className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF4D8D] rounded-full"></span>
            </button>
            <Link
              href="/cart"
              className="p-2 hover:bg-gray-50 rounded-full transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF4D8D] text-white text-xs rounded-full flex items-center justify-center">
                2
              </span>
            </Link>
            <Link
              href="/admin"
              className="flex px-3 py-1.5 md:px-4 md:py-2 bg-gray-900 text-white text-xs md:text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors"
            >
              관리자
            </Link>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-xs md:text-sm text-gray-500 mt-3 mb-3">
          지금, 당신만을 위한 패션 라이브
        </p>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="어떤 스타일을 찾으시나요?"
            className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-gray-50 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-[#FF4D8D]/30 transition-all"
          />
        </div>
      </div>
    </header>
  );
}
