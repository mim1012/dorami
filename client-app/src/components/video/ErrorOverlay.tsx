import { Body } from '../common/Typography';

interface ErrorOverlayProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorOverlay({ message, onRetry }: ErrorOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary-black/80 z-20 p-6">
      <svg
        className="w-16 h-16 text-error mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <Body className="text-error text-center mb-4">{message}</Body>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-hot-pink text-white rounded-button hover:bg-hot-pink/80 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
