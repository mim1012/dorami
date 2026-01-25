import React from 'react';
import { Body } from './Typography';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  helperText,
  fullWidth = false,
  options,
  placeholder = 'Select an option',
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = !!error;

  const baseStyles =
    'rounded-button bg-content-bg text-primary-text px-4 py-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-hot-pink focus:ring-offset-2 focus:ring-offset-primary-black disabled:opacity-50 disabled:cursor-not-allowed appearance-none';

  const errorStyles = hasError
    ? 'border-2 border-error focus:ring-error'
    : 'border-2 border-transparent';

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <div className={`space-y-1 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label htmlFor={selectId} className="block text-body text-primary-text font-medium">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          className={`${baseStyles} ${errorStyles} ${widthStyles} ${className} pr-10`}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-hot-pink">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>

      {error && <Body className="text-error text-caption">{error}</Body>}

      {!error && helperText && (
        <Body className="text-secondary-text text-caption">{helperText}</Body>
      )}
    </div>
  );
}
