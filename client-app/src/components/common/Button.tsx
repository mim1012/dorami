import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-button font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hot-pink focus-visible:ring-offset-2 focus-visible:ring-offset-primary-black disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary:
      'bg-hot-pink text-white not-disabled:hover:bg-hot-pink/90 not-disabled:active:scale-95',
    secondary:
      'bg-content-bg text-primary-text not-disabled:hover:bg-content-bg/80 not-disabled:active:scale-95 border border-border-color',
    outline:
      'border-2 border-hot-pink text-hot-pink not-disabled:hover:bg-hot-pink/10 not-disabled:active:scale-95',
    ghost: 'text-hot-pink not-disabled:hover:bg-hot-pink/10 not-disabled:active:scale-95',
  };

  const sizeStyles = {
    sm: 'min-h-[44px] px-3 py-2.5 text-caption',
    md: 'min-h-[44px] px-4 py-2.5 text-body',
    lg: 'min-h-[44px] px-4 py-3 text-body sm:px-6 sm:py-3.5 sm:text-h2',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
