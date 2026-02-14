'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface SearchBarProps {
  placeholder?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
}

export function SearchBar({
  placeholder = '상품 검색...',
  defaultValue = '',
  onChange,
  onSubmit,
  className = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    onChange?.(debouncedQuery);
  }, [debouncedQuery, onChange]);

  const handleClear = () => {
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit(query);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
        size={20}
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-content-bg text-primary-text placeholder-secondary-text rounded-full pl-12 pr-10 py-3 text-body transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-hot-pink border border-border-color focus:border-hot-pink focus:bg-primary-black"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-text hover:text-primary-text transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
