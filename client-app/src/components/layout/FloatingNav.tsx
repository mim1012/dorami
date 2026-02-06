'use client';

import { useRouter } from 'next/navigation';
import { Bell, User, Package, MessageCircle, Share2 } from 'lucide-react';

export function FloatingNav() {
  const router = useRouter();

  const navItems = [
    {
      icon: Bell,
      label: '공지',
      onClick: () => router.push('/alerts'),
      title: '공지사항',
    },
    {
      icon: User,
      label: '프로필',
      onClick: () => router.push('/my-page'),
      title: '회원정보',
    },
    {
      icon: Package,
      label: '주문',
      onClick: () => router.push('/orders'),
      title: '주문내역',
    },
    {
      icon: MessageCircle,
      label: '문의',
      onClick: () => router.push('/contact'),
      title: '문의하기',
    },
    {
      icon: Share2,
      label: '공유',
      onClick: () => {
        if (navigator.share) {
          navigator.share({
            title: 'DoReMi Live Commerce',
            text: '라이브 커머스 플랫폼 DoReMi',
            url: window.location.href,
          }).catch(() => {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('링크가 복사되었습니다!');
          });
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(window.location.href);
          alert('링크가 복사되었습니다!');
        }
      },
      title: '공유하기',
    },
  ];

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={item.onClick}
            title={item.title}
            className="w-14 h-14 rounded-full bg-card-bg border border-border-color flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:bg-hot-pink hover:text-white hover:scale-110 hover:border-hot-pink"
            style={{ boxShadow: 'var(--shadow-floating)' }}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
