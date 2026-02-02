import { UsersIcon } from '@heroicons/react/24/outline';

interface ChatHeaderProps {
  userCount: number;
  isConnected: boolean;
  compact?: boolean;
}

export default function ChatHeader({ userCount, isConnected, compact = false }: ChatHeaderProps) {
  return (
    <div className={`flex items-center justify-between border-b border-white/10 ${
      compact ? 'px-3 py-2' : 'px-4 py-3'
    }`}>
      <h2 className={`text-hot-pink font-bold ${compact ? 'text-body' : 'text-h2'}`}>
        Chat
      </h2>

      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />

        {/* User Count */}
        <div className="flex items-center gap-1 text-secondary-text text-caption">
          <UsersIcon className="w-4 h-4" />
          <span>{userCount}</span>
        </div>
      </div>
    </div>
  );
}
