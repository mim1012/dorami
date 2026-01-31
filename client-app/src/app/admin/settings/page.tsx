'use client';

import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';

export const dynamic = 'force-dynamic';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary-text mb-2">
          ?¤ì • <span className="text-hot-pink">?™ï¸</span>
        </h1>
        <p className="text-secondary-text">?œìŠ¤???¤ì •??ê´€ë¦¬í•˜?¸ìš”.</p>
      </div>

      {/* Notice Management Section */}
      <NoticeManagement />

      {/* Placeholder for future settings sections */}
      <div className="bg-content-bg border border-white/5 rounded-card p-6 opacity-50">
        <h2 className="text-xl font-semibold text-primary-text mb-2">ê¸°í? ?¤ì •</h2>
        <p className="text-secondary-text text-sm">
          ?¥í›„ ì¶”ê????œìŠ¤???¤ì • ??ª©?¤ì´ ?¬ê¸°???œì‹œ?©ë‹ˆ??
        </p>
      </div>
    </div>
  );
}
