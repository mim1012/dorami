'use client';

import { useRouter } from 'next/navigation';
import { Heading2, Body } from '@/components/common/Typography';

export default function StreamEndedOverlay() {
  const router = useRouter();

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30">
      <div className="text-center">
        <Heading2 className="text-white mb-4">Stream has ended</Heading2>
        <Body className="text-white/70 mb-6">Thank you for watching!</Body>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-hot-pink text-white rounded-button hover:bg-hot-pink-dark transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
