'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X } from 'lucide-react';
import { getCroppedBlob, type PixelCrop } from '@/lib/utils/cropImage';

interface Props {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  mimeType?: string;
}

export function ThumbnailCropModal({
  imageSrc,
  onCancel,
  onConfirm,
  mimeType = 'image/jpeg',
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: unknown, pixels: PixelCrop) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, mimeType);
      onConfirm(blob);
    } catch (err) {
      console.error('크롭 처리 중 오류:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-content-bg rounded-button w-full max-w-lg mx-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <span className="text-primary-text font-medium text-sm">방송 썸네일 크롭 (16:10)</span>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-secondary-text hover:text-primary-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative h-72 md:h-96 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={16 / 10}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t border-border-color">
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary-text shrink-0">확대/축소</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-hot-pink"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border-color">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-sm text-secondary-text border border-border-color rounded-button hover:border-hot-pink/50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !croppedAreaPixels}
            className="px-4 py-2 text-sm text-white bg-hot-pink rounded-button hover:bg-hot-pink/90 transition-colors disabled:opacity-50"
          >
            {isProcessing ? '처리 중...' : '크롭 적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
