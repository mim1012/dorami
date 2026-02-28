export function MainPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Hero skeleton */}
      <div className="relative aspect-[16/9] bg-gray-200">
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <div className="h-4 w-24 rounded-full bg-gray-300" />
          <div className="h-6 w-3/4 rounded-lg bg-gray-300" />
          <div className="h-10 w-full rounded-full bg-gray-300" />
        </div>
      </div>

      {/* Live deals skeleton */}
      <div className="px-4 py-6 space-y-3">
        <div className="h-6 w-32 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white border border-gray-200">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-full rounded bg-gray-200" />
                <div className="h-4 w-2/3 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming slider skeleton */}
      <div className="px-4 py-2 space-y-3">
        <div className="h-6 w-36 rounded-lg bg-gray-200" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="min-w-[280px] rounded-2xl overflow-hidden bg-white border border-gray-200 flex-shrink-0"
            >
              <div className="aspect-[16/10] bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular products skeleton */}
      <div className="px-4 py-6 space-y-3">
        <div className="h-6 w-28 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white border border-gray-200">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-full rounded bg-gray-200" />
                <div className="h-4 w-2/3 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
