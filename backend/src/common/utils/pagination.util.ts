export interface PaginationOptions {
  limit?: number;
  maxLimit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
}

export function parsePagination(
  page?: string | number,
  limit?: string | number,
  options: PaginationOptions = {},
): PaginationResult {
  const { limit: defaultLimit = 24, maxLimit = 100 } = options;

  const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(String(limit), 10) || defaultLimit));

  return { page: parsedPage, limit: parsedLimit };
}
