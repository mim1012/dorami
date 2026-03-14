'use client';

import { Radio, Users, Sparkles, Play } from 'lucide-react';
import Link from 'next/link';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface CurrentLive {
  id: string;
  streamKey: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  startedAt: string;
  host: { id: string; name: string };
}

interface LiveBannerProps {
  currentLive: CurrentLive | null;
  isLoading?: boolean;
}

export function LiveBanner({ currentLive, isLoading = false }: LiveBannerProps) {
  // Show loading state
  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-gradient-to-br from-[#FFE5EE] via-[#FFF0F5] to-[#F5EDFF] shadow-xl p-6 md:p-10 min-h-[300px] md:min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-gray-400 text-lg">로딩 중...</div>
        </div>
      </div>
    );
  }

  // Show fallback if no live stream
  if (!currentLive) {
    return (
      <div className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-gradient-to-br from-[#FFE5EE] via-[#FFF0F5] to-[#F5EDFF] shadow-xl">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-8 p-6 md:p-10">
          <div className="flex flex-col justify-center space-y-4 md:space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                곧 시작하는 라이브를 기다려주세요
              </h2>
              <p className="text-sm md:text-base lg:text-lg text-gray-600">
                실시간 방송 예정을 확인하고 특가 혜택을 받으세요
              </p>
            </div>
            <Link
              href="/upcoming"
              className="group relative block w-full px-8 py-4 md:py-5 bg-gradient-to-r from-[#FF4D8D] via-[#FF6BA0] to-[#FF4D8D] text-white rounded-full font-bold text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 overflow-hidden text-center"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              <div className="relative">예정된 라이브 보기</div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Display current LIVE stream
  const placeholderImage =
    'https://images.unsplash.com/photo-1638385583463-e3d424c22916?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMGJlaWdlJTIwY29hdCUyMHdpbnRlcnxlbnwxfHx8fDE3NzIwOTIxMjF8MA&ixlib=rb-4.1.0&q=80&w=1080';
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
              <span className="text-sm font-semibold text-gray-700">
                {currentLive.viewerCount.toLocaleString()}명 시청중
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              {currentLive.title}
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-gray-600">
              {currentLive.host.name}님의 라이브 방송
            </p>
          </div>

          {/* CTA Button */}
          <Link
            href={`/live/${currentLive.streamKey}`}
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
          <div className="absolute inset-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl bg-white">
            <ImageWithFallback
              src={currentLive.thumbnailUrl || placeholderImage}
              alt={currentLive.title}
              className="w-full h-full object-contain"
            />
            {/* Play Icon Overlay */}
            <Link
              href={`/live/${currentLive.streamKey}`}
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
