'use client';

import React from 'react';
import { Heading2 } from './Typography';
import { useModalBehavior } from '@/lib/hooks/use-modal-behavior';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  useModalBehavior({ isOpen, onClose });

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full overflow-y-auto rounded-[20px] bg-content-bg p-4 pb-[env(safe-area-inset-bottom)] shadow-xl ${maxWidthClasses[maxWidth]} max-h-[calc(100vh-1rem)] sm:mx-0 sm:max-h-[calc(100vh-2rem)] sm:rounded-button sm:p-6`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-h2 text-hot-pink">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center text-secondary-text hover:text-hot-pink transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-hot-pink rounded-button"
            aria-label="모달 닫기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
