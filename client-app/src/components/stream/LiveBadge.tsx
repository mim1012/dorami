export default function LiveBadge() {
  return (
    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-hot-pink rounded-full z-10">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="text-white text-sm font-bold">LIVE</span>
    </div>
  );
}
