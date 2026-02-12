import { EntityNotFoundException } from '../exceptions/business.exception';

export async function findOrThrow<T>(
  query: Promise<T | null>,
  entityName: string,
  id: string | number,
): Promise<T> {
  const result = await query;
  if (!result) {
    throw new EntityNotFoundException(entityName, id);
  }
  return result;
}
