export interface PaginationOptions {
  limit?: number;
  maxLimit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
}

const ENV_DEFAULT_LIMIT = parseInt(process.env.PAGINATION_DEFAULT_LIMIT ?? '24', 10);
const ENV_MAX_LIMIT = parseInt(process.env.PAGINATION_MAX_LIMIT ?? '100', 10);

export function parsePagination(
  page?: string | number,
  limit?: string | number,
  options: PaginationOptions = {},
): PaginationResult {
  const { limit: defaultLimit = ENV_DEFAULT_LIMIT, maxLimit = ENV_MAX_LIMIT } = options;

  const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(String(limit), 10) || defaultLimit));

  return { page: parsedPage, limit: parsedLimit };
}
