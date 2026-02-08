import React from 'react';
import { PackageOpen, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-content-bg flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-secondary-text" aria-hidden="true" />
      </div>
      <h3 className="text-h3 text-primary-text mb-1">{title}</h3>
      {description && (
        <p className="text-caption text-secondary-text max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-6 py-2.5 bg-hot-pink text-white rounded-button text-caption font-medium hover:bg-hot-pink-dark transition-colors min-h-[44px]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
