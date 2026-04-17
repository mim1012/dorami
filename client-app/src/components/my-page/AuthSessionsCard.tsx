'use client';

import { useMemo } from 'react';
import type { AuthSessionSummary } from '@/lib/api/auth-sessions';
import { Body, Heading2 } from '@/components/common/Typography';

interface AuthSessionsCardProps {
  sessions: AuthSessionSummary[];
  loading?: boolean;
  revokingSessionId?: string | null;
  onRevokeSession: (sessionId: string) => void;
}

function formatSessionTimestamp(value?: string | null): string {
  if (!value) return '정보 없음';

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return '정보 없음';
  }
}

function getSessionLabel(session: AuthSessionSummary): string {
  return session.deviceName || session.deviceType || session.userAgent || '알 수 없는 기기';
}

export function AuthSessionsCard({
  sessions,
  loading = false,
  revokingSessionId,
  onRevokeSession,
}: AuthSessionsCardProps) {
  const activeSessions = useMemo(
    () => sessions.filter((session) => !session.revokedAt),
    [sessions],
  );

  return (
    <section className="bg-content-bg rounded-2xl border border-border-color p-5 mt-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <Heading2 className="text-primary-text">로그인 세션</Heading2>
          <Body className="text-secondary-text text-sm mt-1">
            현재 로그인된 기기와 최근 세션을 확인할 수 있어요.
          </Body>
        </div>
        <div className="px-3 py-1 rounded-full bg-primary-black border border-border-color text-xs text-secondary-text whitespace-nowrap">
          {activeSessions.length}개 활성 세션
        </div>
      </div>

      {loading ? (
        <Body className="text-secondary-text text-sm">세션 정보를 불러오는 중...</Body>
      ) : activeSessions.length === 0 ? (
        <Body className="text-secondary-text text-sm">활성 세션 정보가 없습니다.</Body>
      ) : (
        <div className="space-y-3">
          {activeSessions.map((session) => {
            const isRevoking = revokingSessionId === session.id;
            return (
              <div
                key={session.id}
                className="rounded-xl border border-border-color bg-primary-black/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Body className="text-primary-text font-semibold text-sm">
                        {getSessionLabel(session)}
                      </Body>
                      {session.current && (
                        <span className="px-2 py-0.5 rounded-full bg-hot-pink/15 text-hot-pink text-[11px] font-semibold">
                          현재 기기
                        </span>
                      )}
                    </div>
                    <Body className="text-secondary-text text-xs mt-2">
                      최근 사용: {formatSessionTimestamp(session.lastUsedAt || session.updatedAt)}
                    </Body>
                    <Body className="text-secondary-text text-xs mt-1">
                      만료 예정: {formatSessionTimestamp(session.expiresAt)}
                    </Body>
                    {session.ipAddress && (
                      <Body className="text-secondary-text text-xs mt-1">IP: {session.ipAddress}</Body>
                    )}
                  </div>

                  {!session.current && (
                    <button
                      type="button"
                      onClick={() => onRevokeSession(session.id)}
                      disabled={isRevoking}
                      className="shrink-0 rounded-lg border border-border-color px-3 py-2 text-xs text-primary-text hover:bg-content-bg disabled:opacity-50"
                    >
                      {isRevoking ? '정리 중...' : '로그아웃'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
