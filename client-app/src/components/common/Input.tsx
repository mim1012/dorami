import React from 'react';
import { Body } from './Typography';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  fullWidth = false,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = !!error;

  const baseStyles =
    'rounded-button bg-content-bg text-primary-text px-4 py-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-hot-pink focus:ring-offset-2 focus:ring-offset-primary-black disabled:opacity-50 disabled:cursor-not-allowed';

  const errorStyles = hasError
    ? 'border-2 border-error focus:ring-error'
    : 'border border-gray-300 focus:border-hot-pink';

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <div className={`space-y-1 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label htmlFor={inputId} className="block text-body text-primary-text font-medium">
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={`${baseStyles} ${errorStyles} ${widthStyles} ${className}`}
        {...props}
      />

      {error && <Body className="text-error text-caption">{error}</Body>}

      {!error && helperText && (
        <Body className="text-secondary-text text-caption">{helperText}</Body>
      )}
    </div>
  );
}
