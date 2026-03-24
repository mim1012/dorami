export function createQueryKeys<T extends string>(entity: T) {
  const all = [entity] as const;
  return {
    all,
    lists: () => [...all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...all, 'list', filters] as const,
    details: () => [...all, 'detail'] as const,
    detail: (id: string | number) => [...all, 'detail', id] as const,
  };
}
