'use client';

import { NoticeManagement } from '@/components/admin/settings/NoticeManagement';

export const dynamic = 'force-dynamic';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary-text mb-2">
          ?정 <span className="text-hot-pink">?️</span>
        </h1>
        <p className="text-secondary-text">?스???정??관리하?요.</p>
      </div>

      {/* Notice Management Section */}
      <NoticeManagement />

      {/* Placeholder for future settings sections */}
      <div className="bg-content-bg border border-gray-200 rounded-card p-6 opacity-50">
        <h2 className="text-xl font-semibold text-primary-text mb-2">기? ?정</h2>
        <p className="text-secondary-text text-sm">
          ?후 추????스???정 ???이 ?기???시?니??
        </p>
      </div>
    </div>
  );
}
