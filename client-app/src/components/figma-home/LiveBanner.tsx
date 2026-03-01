'use client';

import { Radio, Users, Sparkles, Play } from 'lucide-react';
import Link from 'next/link';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function LiveBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-gradient-to-br from-[#FFE5EE] via-[#FFF0F5] to-[#F5EDFF] shadow-xl">
      {/* Live Indicator Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF4D8D] via-[#FF6BA0] to-[#FF4D8D] animate-pulse"></div>

      <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-8 p-6 md:p-10">
        {/* Left Content */}
        <div className="flex flex-col justify-center space-y-4 md:space-y-6">
          {/* Live Status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 px-5 py-2.5 bg-white rounded-full shadow-md">
              <div className="relative">
                <Radio className="w-5 h-5 text-[#FF4D8D] animate-pulse" fill="#FF4D8D" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FF4D8D] rounded-full animate-ping"></div>
              </div>
              <span className="font-bold text-base text-[#FF4D8D]">LIVE NOW</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
              <Users className="w-4 h-4 text-[#B084CC]" />
              <span className="text-sm font-semibold text-gray-700">2,453명 시청중</span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              윈터 코트 특집
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-gray-600">
              이번 겨울 필수 아이템, 놓치지 마세요
            </p>
          </div>

          {/* CTA Button */}
          <Link
            href="/live"
            className="group relative block w-full px-8 py-4 md:py-5 bg-gradient-to-r from-[#FF4D8D] via-[#FF6BA0] to-[#FF4D8D] text-white rounded-full font-bold text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 overflow-hidden text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            <div className="relative flex items-center justify-center gap-3">
              <Play className="w-5 h-5" fill="white" />
              <span>지금 바로 입장하기</span>
            </div>
          </Link>
        </div>

        {/* Right Image */}
        <div className="relative h-64 md:h-auto md:min-h-[400px] lg:min-h-[500px]">
          <div className="absolute inset-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1638385583463-e3d424c22916?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMGJlaWdlJTIwY29hdCUyMHdpbnRlcnxlbnwxfHx8fDE3NzIwOTIxMjF8MA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Live Fashion"
              className="w-full h-full object-cover"
            />
            {/* Play Icon Overlay */}
            <Link
              href="/live"
              aria-label="라이브로 이동하기"
              className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent flex items-center justify-center"
            >
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer">
                <Play className="w-8 h-8 md:w-12 md:h-12 text-[#FF4D8D] ml-1" fill="#FF4D8D" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
