export function createQueryKeys<T extends string>(entity: T) {
  return {
    all: [entity] as const,
    lists: () => [...createQueryKeys(entity).all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...createQueryKeys(entity).lists(), filters] as const,
    details: () => [...createQueryKeys(entity).all, 'detail'] as const,
    detail: (id: string | number) => [...createQueryKeys(entity).details(), id] as const,
  };
}
