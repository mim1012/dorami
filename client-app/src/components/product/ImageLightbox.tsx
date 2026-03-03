'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import Image from 'next/image';

interface ImageLightboxProps {
  images: string[];
  productName: string;
  initialIndex?: number;
  onClose: () => void;
  /** Callback when user navigates to a different image inside lightbox */
  onIndexChange?: (index: number) => void;
}

export function ImageLightbox({
  images,
  productName,
  initialIndex = 0,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasMultiple = images.length > 1;
  const currentSrc = images[currentIndex];
  const isUpload = currentSrc?.startsWith('/uploads/');

  const navigateTo = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setIsZoomed(false);
      onIndexChange?.(index);
    },
    [onIndexChange],
  );

  const goPrev = useCallback(() => {
    navigateTo(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  }, [currentIndex, images.length, navigateTo]);

  const goNext = useCallback(() => {
    navigateTo(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, images.length, navigateTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && !isZoomed) goPrev();
      if (e.key === 'ArrowRight' && !isZoomed) goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext, isZoomed]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isZoomed) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isZoomed || touchStartXRef.current === null || touchStartYRef.current === null) return;

    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) goNext();
      else goPrev();
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) {
      // Calculate zoom origin based on click position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin({ x, y });
      setIsZoomed(true);
    } else {
      setIsZoomed(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} 이미지 뷰어`}
      data-testid="image-lightbox"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-white/70 text-sm">
          {currentIndex + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsZoomed((z) => !z)}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label={isZoomed ? '축소' : '확대'}
          >
            {isZoomed ? (
              <ZoomOut className="w-5 h-5 text-white" />
            ) : (
              <ZoomIn className="w-5 h-5 text-white" />
            )}
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden flex items-center justify-center ${
          isZoomed ? 'cursor-zoom-out overflow-auto' : 'cursor-zoom-in'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleImageClick}
      >
        {currentSrc && (
          <div
            className={`relative transition-transform duration-300 ${
              isZoomed ? 'scale-200' : 'scale-100'
            }`}
            style={
              isZoomed
                ? {
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                    transform: 'scale(2.5)',
                  }
                : {}
            }
          >
            {/* Use img tag for lightbox to avoid layout constraints */}
            <img
              src={currentSrc}
              alt={`${productName} 이미지 ${currentIndex + 1}`}
              className="max-w-[90vw] max-h-[75vh] object-contain block"
              draggable={false}
            />
          </div>
        )}

        {/* Prev / Next nav */}
        {hasMultiple && !isZoomed && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors z-10"
              aria-label="이전 이미지"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors z-10"
              aria-label="다음 이미지"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}
      </div>

      {/* Bottom: thumbnail strip & dot indicators */}
      {hasMultiple && (
        <div className="flex-shrink-0 pb-4 pt-3 flex flex-col items-center gap-3">
          {/* Dot indicators */}
          <div className="flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => navigateTo(idx)}
                className={`rounded-full transition-all duration-200 ${
                  idx === currentIndex
                    ? 'bg-hot-pink w-5 h-2'
                    : 'bg-white/40 hover:bg-white/70 w-2 h-2'
                }`}
                aria-label={`이미지 ${idx + 1}`}
                aria-current={idx === currentIndex}
              />
            ))}
          </div>

          {/* Thumbnail strip in lightbox */}
          <div className="flex gap-2 overflow-x-auto max-w-full px-4">
            {images.map((src, idx) => {
              const isActive = idx === currentIndex;
              const thumbIsUpload = src.startsWith('/uploads/');
              return (
                <button
                  key={idx}
                  onClick={() => navigateTo(idx)}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all duration-150 ${
                    isActive
                      ? 'ring-2 ring-hot-pink opacity-100'
                      : 'ring-1 ring-white/20 opacity-50 hover:opacity-80'
                  }`}
                  aria-label={`이미지 ${idx + 1}`}
                >
                  <Image
                    src={src}
                    alt={`썸네일 ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized={thumbIsUpload}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
