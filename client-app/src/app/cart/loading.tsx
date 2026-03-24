import { Skeleton } from '@/components/common/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-card-bg rounded-card border border-border-color p-4 flex gap-4">
          <Skeleton className="w-20 h-20 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
