'use client';

import { Instagram, Youtube, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-20">
      <div className="max-w-screen-2xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4D8D] to-[#B084CC] flex items-center justify-center">
                <span className="text-white font-bold">L</span>
              </div>
              <h1 className="font-bold text-xl bg-gradient-to-r from-[#FF4D8D] to-[#B084CC] bg-clip-text text-transparent">
                LIVE
              </h1>
            </div>
            <p className="text-sm text-gray-600 mb-4 max-w-md">
              실시간으로 만나는 당신만을 위한 패션 큐레이션.
              <br />
              매일 새로운 라이브로 특별한 스타일을 경험하세요.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-[#FF4D8D] hover:text-white transition-colors shadow-sm"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-[#FF4D8D] hover:text-white transition-colors shadow-sm"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-[#FF4D8D] hover:text-white transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">고객센터</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="#" className="hover:text-[#FF4D8D] transition-colors">
                  공지사항
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FF4D8D] transition-colors">
                  자주 묻는 질문
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FF4D8D] transition-colors">
                  1:1 문의
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">셀러 지원</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="#" className="hover:text-[#FF4D8D] transition-colors">
                  입점 신청
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FF4D8D] transition-colors">
                  라이브 가이드
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FF4D8D] transition-colors">
                  파트너 센터
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500">© 2026 LIVE. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <a href="#" className="hover:text-gray-900 transition-colors">
                이용약관
              </a>
              <span>·</span>
              <a href="#" className="hover:text-gray-900 transition-colors">
                개인정보처리방침
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
