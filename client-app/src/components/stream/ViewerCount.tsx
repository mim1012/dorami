import { EyeIcon } from '@heroicons/react/24/outline';

interface ViewerCountProps {
  count: number;
}

export default function ViewerCount({ count }: ViewerCountProps) {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-black/60 rounded-full z-10">
      <EyeIcon className="w-4 h-4 text-white" />
      <span className="text-white text-sm">{count} watching</span>
    </div>
  );
}
