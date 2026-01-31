'use client';

import Image from 'next/image';

interface UpcomingLiveCardProps {
  id: string;
  title: string;
  scheduledTime: Date;
  thumbnailUrl: string;
  isLive?: boolean;
  onClick?: () => void;
}

export function UpcomingLiveCard({
  title,
  scheduledTime,
  thumbnailUrl,
  isLive = false,
  onClick
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
      className="bg-content-bg rounded-[12px] overflow-hidden cursor-pointer transition-transform hover:scale-105 active:scale-95"
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
          <div className="absolute top-3 left-3 bg-error text-white text-caption px-4 py-1.5 rounded-full font-bold animate-pulse-hot-pink flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            LIVE
          </div>
        )}
        {!isLive && (
          <div className="absolute top-3 left-3 bg-hot-pink text-white text-caption px-4 py-1.5 rounded-full font-medium">
            예정
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
