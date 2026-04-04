import { Metadata } from 'next';
import { MessageCircle, Mail, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: '문의하기 | 도레미 마켓',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-primary-black px-4 py-12 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-primary-text mb-2">문의하기</h1>
        <p className="text-secondary-text text-sm">
          궁금한 점이 있으시면 아래 채널로 문의해 주세요.
        </p>
      </div>

      <div className="space-y-4">
        <a
          href="https://pf.kakao.com/_your_channel"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 rounded-2xl bg-content-bg border border-border-color hover:border-hot-pink transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-[#3A1D1D]" />
          </div>
          <div>
            <p className="font-bold text-primary-text">카카오톡 채널</p>
            <p className="text-secondary-text text-sm">
              빠른 답변을 원하시면 카카오톡으로 문의하세요
            </p>
          </div>
        </a>

        <a
          href="mailto:support@doremi-live.com"
          className="flex items-center gap-4 p-5 rounded-2xl bg-content-bg border border-border-color hover:border-hot-pink transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-content-bg border border-border-color flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-hot-pink" />
          </div>
          <div>
            <p className="font-bold text-primary-text">이메일 문의</p>
            <p className="text-secondary-text text-sm">support@doremi-live.com</p>
          </div>
        </a>

        <div className="flex items-center gap-4 p-5 rounded-2xl bg-content-bg border border-border-color">
          <div className="w-12 h-12 rounded-full bg-content-bg border border-border-color flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-secondary-text" />
          </div>
          <div>
            <p className="font-bold text-primary-text">운영 시간</p>
            <p className="text-secondary-text text-sm">평일 10:00 - 18:00 (주말 및 공휴일 휴무)</p>
          </div>
        </div>
      </div>
    </main>
  );
}
