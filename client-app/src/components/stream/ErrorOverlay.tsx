interface ErrorOverlayProps {
  message: string;
}

export default function ErrorOverlay({ message }: ErrorOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
      <div className="text-center">
        <p className="text-white text-lg mb-2">⚠️</p>
        <p className="text-white">{message}</p>
      </div>
    </div>
  );
}
