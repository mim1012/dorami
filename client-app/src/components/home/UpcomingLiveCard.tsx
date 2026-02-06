'use client';

import Image from 'next/image';

interface UpcomingLiveCardProps {
  id: string;
  title: string;
  scheduledTime: Date;
  thumbnailUrl: string;
  isLive?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'small';
}

export function UpcomingLiveCard({
  title,
  scheduledTime,
  thumbnailUrl,
  isLive = false,
  onClick,
  size = 'normal'
}: UpcomingLiveCardProps) {
  const formatTime = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    return `${month}월 ${day}일 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer ${
        size === 'small' ? 'scale-[0.95] md:scale-[0.6] origin-center' : ''
      }`}
    >
      <div className="relative aspect-video bg-primary-black">
        <Image
          src={thumbnailUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {isLive && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-3 py-1.5 rounded-md font-bold animate-pulse-live flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            ● LIVE
          </div>
        )}
        {!isLive && (
          <div className="absolute bottom-3 right-3 bg-hot-pink/90 text-white text-base px-4 py-2 rounded-lg font-bold backdrop-blur-sm">
            {(() => {
              const now = new Date().getTime();
              const target = new Date(scheduledTime).getTime();
              const difference = target - now;
              if (difference <= 0) return '곧 시작';
              const hours = Math.floor(difference / (1000 * 60 * 60));
              const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((difference % (1000 * 60)) / 1000);
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            })()}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-body text-primary-text font-semibold mb-2 line-clamp-2">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-secondary-text"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-caption text-secondary-text">
            {formatTime(scheduledTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
