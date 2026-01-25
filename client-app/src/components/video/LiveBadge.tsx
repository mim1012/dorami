export function LiveBadge() {
  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="flex items-center gap-2 bg-hot-pink rounded-button px-4 py-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-white font-bold text-caption uppercase">Live</span>
      </div>
    </div>
  );
}
