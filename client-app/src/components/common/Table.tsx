'use client';

import React from 'react';
import { Body } from './Typography';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
  getRowClassName?: (item: T) => string;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  sortBy,
  sortOrder,
  onSort,
  emptyMessage = 'No data available',
  getRowClassName,
}: TableProps<T>) {
  const handleSort = (key: string, sortable: boolean = true) => {
    if (sortable && onSort) {
      onSort(key);
    }
  };

  return (
    <div className="overflow-x-auto rounded-button border border-content-bg">
      <table className="min-w-full divide-y divide-content-bg">
        <thead className="bg-content-bg">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => handleSort(column.key, column.sortable)}
                className={`px-6 py-3 text-left text-caption font-medium text-secondary-text uppercase tracking-wider ${
                  column.sortable ? 'cursor-pointer hover:text-hot-pink transition-colors' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && sortBy === column.key && (
                    <svg
                      className={`w-4 h-4 text-hot-pink transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-primary-black divide-y divide-content-bg">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center">
                <Body className="text-secondary-text">{emptyMessage}</Body>
              </td>
            </tr>
          ) : (
            data.map((item) => {
              const customRowClass = getRowClassName ? getRowClassName(item) : '';
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-content-bg/50 transition-colors ${customRowClass}`}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                      <Body className="text-primary-text">
                        {column.render
                          ? column.render(item)
                          : (item as any)[column.key]?.toString() || '-'}
                      </Body>
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
