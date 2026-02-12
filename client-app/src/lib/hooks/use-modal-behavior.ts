'use client';

import { useEffect } from 'react';

interface UseModalBehaviorOptions {
  isOpen: boolean;
  onClose: () => void;
  lockScroll?: boolean;
}

export function useModalBehavior({ isOpen, onClose, lockScroll = true }: UseModalBehaviorOptions) {
  useEffect(() => {
    if (!lockScroll) return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, lockScroll]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
}
