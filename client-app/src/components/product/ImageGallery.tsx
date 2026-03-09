'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ZoomIn, Package } from 'lucide-react';
import { ThumbnailStrip } from './ThumbnailStrip';
import { ImageLightbox } from './ImageLightbox';

interface ImageGalleryProps {
  images: string[];
  productName: string;
  /** Show thumbnail strip below the main image. Default: true when images.length > 1 */
  showThumbnails?: boolean;
  /** Aspect ratio class for the main image container. Default: 'aspect-square' */
  aspectRatio?: string;
  className?: string;
}

export function ImageGallery({
  images,
  productName,
  showThumbnails,
  aspectRatio = 'aspect-square',
  className = '',
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const imageList = images.length > 0 ? images : [];
  const hasImages = imageList.length > 0;
  const hasMultiple = imageList.length > 1;
  const shouldShowThumbnails = showThumbnails !== undefined ? showThumbnails : hasMultiple;

  // Reset index when images change
  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? imageList.length - 1 : prev - 1));
  }, [imageList.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === imageList.length - 1 ? 0 : prev + 1));
  }, [imageList.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;

    // Only trigger swipe if horizontal movement is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!hasMultiple) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasMultiple, goPrev, goNext]);

  if (!hasImages) {
    return (
      <div className={`relative w-full ${aspectRatio} bg-primary-black ${className}`}>
        <div className="w-full h-full flex items-center justify-center">
          <Package className="w-16 h-16 text-secondary-text opacity-20" />
        </div>
      </div>
    );
  }

  const currentSrc = imageList[currentIndex];
  const isUpload = currentSrc.startsWith('/uploads/');

  return (
    <div className={`w-full select-none ${className}`} data-testid="image-gallery">
      {/* Main image area */}
      <div
        className={`relative w-full ${aspectRatio} bg-primary-black overflow-hidden cursor-zoom-in`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setLightboxOpen(true)}
        role="button"
        aria-label="이미지 확대 보기"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setLightboxOpen(true);
        }}
      >
        <Image
          key={currentSrc}
          src={currentSrc}
          alt={`${productName} 이미지 ${currentIndex + 1}`}
          fill
          className="object-contain transition-opacity duration-200"
          sizes="(max-width: 768px) 100vw, 600px"
          unoptimized={isUpload}
          priority={currentIndex === 0}
        />

        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-2 pointer-events-none">
          <ZoomIn className="w-4 h-4 text-white/80" />
        </div>

        {/* Prev / Next arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 min-w-11 min-h-11 p-2 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10"
              aria-label="이전 이미지"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 min-w-11 min-h-11 p-2 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10"
              aria-label="다음 이미지"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {imageList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`rounded-full transition-all duration-200 ${
                    idx === currentIndex
                      ? 'bg-hot-pink w-6 h-2'
                      : 'bg-white/50 hover:bg-white/80 w-2.5 h-2.5'
                  }`}
                  aria-label={`이미지 ${idx + 1}`}
                  aria-current={idx === currentIndex}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {shouldShowThumbnails && (
        <ThumbnailStrip
          images={imageList}
          productName={productName}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
        />
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={imageList}
          productName={productName}
          initialIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setCurrentIndex}
        />
      )}
    </div>
  );
}
