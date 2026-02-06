'use client';

import React from 'react';
import { Button } from './Button';
import { Body, Caption } from './Typography';
import { Select } from './Select';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(parseInt(e.target.value, 10));
    onPageChange(1); // Reset to first page when changing page size
  };

  if (totalItems === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
      {/* Page Info */}
      <div className="flex items-center gap-4">
        <Body className="text-secondary-text text-caption">
          {totalItems}개 중 {startItem}-{endItem} 표시
        </Body>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <Caption className="text-secondary-text">페이지당 행 수:</Caption>
          <Select
            value={pageSize.toString()}
            onChange={handlePageSizeChange}
            options={[
              { value: '10', label: '10' },
              { value: '20', label: '20' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
            className="w-20"
          />
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1}
        >
          이전
        </Button>

        <Body className="text-primary-text px-4">
          {currentPage} / {totalPages} 페이지
        </Body>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
