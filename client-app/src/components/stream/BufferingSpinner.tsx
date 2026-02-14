export default function BufferingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
      <div className="w-16 h-16 border-4 border-content-bg border-t-hot-pink rounded-full animate-spin" />
    </div>
  );
}
