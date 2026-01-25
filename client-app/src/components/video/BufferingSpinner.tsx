export function BufferingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-primary-black/50 z-20">
      <div className="w-16 h-16 border-4 border-hot-pink border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
