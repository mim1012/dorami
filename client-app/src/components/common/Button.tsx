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
    'rounded-button font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hot-pink focus-visible:ring-offset-2 focus-visible:ring-offset-primary-black disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-hot-pink text-white enabled:hover:bg-hot-pink/90 enabled:active:scale-95',
    secondary:
      'bg-content-bg text-primary-text enabled:hover:bg-content-bg/80 enabled:active:scale-95 border border-border-color',
    outline:
      'border-2 border-hot-pink text-hot-pink enabled:hover:bg-hot-pink enabled:hover:text-white enabled:active:scale-95',
    ghost: 'text-hot-pink enabled:hover:bg-hot-pink/10 enabled:active:scale-95',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-caption',
    md: 'px-4 py-2 text-body',
    lg: 'px-6 py-3 text-h2',
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
