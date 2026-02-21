export function Footer() {
  return (
    <footer className="relative mt-2 pb-2">
      {/* Gradient divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-hot-pink/60 to-transparent mb-6" />

      <div className="px-4 space-y-5">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-hot-pink to-[#7928CA] flex items-center justify-center shadow-hot-pink flex-shrink-0">
            <span className="text-white font-black text-base">D</span>
          </div>
          <div>
            <p className="text-sm font-black bg-gradient-to-r from-hot-pink via-[#FF4500] to-[#7928CA] bg-clip-text text-transparent leading-none">
              DoRaMi
            </p>
            <p className="text-[10px] text-secondary-text tracking-widest uppercase mt-0.5">
              Live Shopping Experience
            </p>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-xs text-secondary-text/70">라이브로 만나는 특별한 쇼핑</p>

        {/* Business info card */}
        <div className="rounded-2xl bg-content-bg border border-white/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-3 rounded-full bg-gradient-to-b from-hot-pink to-[#7928CA]" />
            <span className="text-[10px] font-bold text-secondary-text uppercase tracking-widest">
              사업자 정보
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-secondary-text">
            <div className="flex gap-2">
              <span className="text-secondary-text/50 w-20 flex-shrink-0">사업자 번호</span>
              <span className="text-primary-text/80 font-medium">194-44-00522</span>
            </div>
            <div className="flex gap-2">
              <span className="text-secondary-text/50 w-20 flex-shrink-0">통신판매업</span>
              <span className="text-primary-text/80 font-medium">제 2021-대전유성-1024 호</span>
            </div>
            <div className="flex gap-2">
              <span className="text-secondary-text/50 w-20 flex-shrink-0">문의</span>
              <a
                href="mailto:422sss@live.com"
                className="text-hot-pink/80 font-medium hover:text-hot-pink transition-colors"
              >
                422sss@live.com
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-[10px] text-secondary-text/40 text-center pb-1">
          © {new Date().getFullYear()} DoRaMi. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
