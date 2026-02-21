'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface LegalModalProps {
  type: 'terms' | 'privacy' | null;
  onClose: () => void;
}

export function LegalModal({ type, onClose }: LegalModalProps) {
  const isOpen = type !== null;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="relative w-full bg-[#111111] rounded-t-3xl max-h-[90dvh] flex flex-col border-t border-white/10 animate-slide-up-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={type === 'terms' ? '이용약관' : '개인정보 처리방침'}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">
              {type === 'terms' ? '이용약관' : '개인정보 처리방침'}
            </h2>
            <p className="text-[10px] text-white/40 mt-0.5">
              시행일: 2021.10.01 · 최종 수정: 2024.01.01
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 active:scale-90 transition-all"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
          {type === 'terms' ? <TermsContent /> : <PrivacyContent />}

          <div className="pt-4 border-t border-white/8 text-[10px] text-white/30 space-y-0.5">
            <p>상호명: Doremi · 대표자: 김민성</p>
            <p>사업자등록번호: 194-44-00522</p>
            <p>통신판매업신고번호: 제 2021-대전유성-1024 호</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Terms content ──────────────────────────────────────────────────────── */
function TermsContent() {
  return (
    <>
      <Section title="제1조 (목적)">
        이 약관은 Doremi(이하 "회사")가 운영하는 라이브 커머스 플랫폼 서비스의 이용과 관련하여
        회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
      </Section>

      <Section title="제2조 (정의)">
        <ol className="list-decimal list-inside space-y-1">
          <li>"서비스"란 회사가 제공하는 라이브 스트리밍 기반 전자상거래 플랫폼을 의미합니다.</li>
          <li>"회원"이란 회사와 서비스 이용계약을 체결하고 회원 가입을 완료한 자를 말합니다.</li>
          <li>
            "라이브 방송"이란 판매자가 실시간으로 상품을 소개·판매하는 영상 서비스를 말합니다.
          </li>
        </ol>
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ol className="list-decimal list-inside space-y-1">
          <li>
            본 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이
            발생합니다.
          </li>
          <li>
            회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은 시행일
            7일 전부터 공지합니다.
          </li>
          <li>
            회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
          </li>
        </ol>
      </Section>

      <Section title="제4조 (서비스 제공)">
        회사는 실시간 라이브 방송 시청, 상품 구매, 채팅, 장바구니 및 주문 관리, 알림 서비스를
        제공합니다. 서비스는 연중무휴 24시간 제공을 원칙으로 하며, 시스템 점검 등의 사유로 일시
        중단될 수 있습니다.
      </Section>

      <Section title="제5조 (회원가입 및 탈퇴)">
        <ol className="list-decimal list-inside space-y-1">
          <li>이용자는 카카오 계정을 통해 회원가입을 신청할 수 있습니다.</li>
          <li>만 14세 미만의 아동은 서비스를 이용할 수 없습니다.</li>
          <li>회원은 언제든지 마이페이지에서 탈퇴를 신청할 수 있습니다.</li>
          <li>탈퇴 시 진행 중인 주문, 미사용 포인트 등은 소멸될 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제6조 (회원의 의무)">
        <p className="mb-1.5">회원은 다음 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>타인의 정보 도용 및 허위 정보 등록</li>
          <li>회사 및 제3자의 저작권 등 지식재산권 침해</li>
          <li>채팅에서 욕설, 비방, 음란한 내용 게시</li>
          <li>서비스의 정상적인 운영을 방해하는 행위</li>
        </ul>
      </Section>

      <Section title="제7조 (구매 및 결제)">
        <ol className="list-decimal list-inside space-y-1">
          <li>회원은 라이브 방송 중 장바구니를 통해 상품을 구매할 수 있습니다.</li>
          <li>장바구니는 방송 종료 후 10분간 유지되며, 이후 자동 삭제됩니다.</li>
          <li>결제 전 상품 정보와 가격을 반드시 확인하시기 바랍니다.</li>
        </ol>
      </Section>

      <Section title="제8조 (청약철회 및 환불)">
        <ol className="list-decimal list-inside space-y-1">
          <li>회원은 상품 수령일로부터 7일 이내에 청약철회를 신청할 수 있습니다.</li>
          <li>
            회원의 사용 또는 일부 소비로 상품 가치가 현저히 감소한 경우 청약철회가 제한될 수
            있습니다.
          </li>
          <li>환불은 청약철회 신청 확인 후 3영업일 이내에 처리됩니다.</li>
          <li>반품 배송비는 원칙적으로 회원이 부담하며, 상품 하자의 경우 회사가 부담합니다.</li>
        </ol>
      </Section>

      <Section title="제9조 (면책 및 분쟁 해결)">
        <ol className="list-decimal list-inside space-y-1">
          <li>회사는 천재지변, 불가항력적 사유로 인한 서비스 제공 불가 시 책임이 면제됩니다.</li>
          <li>
            서비스 이용 관련 분쟁은 상호 협의를 통해 해결하며, 협의가 이루어지지 않을 경우 관할
            법원에 소를 제기할 수 있습니다.
          </li>
        </ol>
      </Section>
    </>
  );
}

/* ── Privacy content ────────────────────────────────────────────────────── */
function PrivacyContent() {
  return (
    <>
      <p className="text-[11px] text-white/50 leading-relaxed">
        Doremi는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을
        신속하게 처리하기 위해 다음과 같이 개인정보 처리방침을 수립·공개합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <div className="space-y-2">
          <InfoBox label="필수 항목 (카카오 로그인 시)">
            카카오 계정 ID, 닉네임, 프로필 이미지
          </InfoBox>
          <InfoBox label="추가 수집 항목 (구매 시)">
            배송지 주소(AES-256 암호화 저장), 입금자명, 연락처
          </InfoBox>
          <InfoBox label="자동 수집 항목">IP 주소, 쿠키, 서비스 이용 기록, 기기 정보</InfoBox>
        </div>
      </Section>

      <Section title="2. 개인정보 수집 및 이용 목적">
        <ul className="list-disc list-inside space-y-1">
          <li>회원 식별 및 서비스 제공</li>
          <li>주문 처리 및 배송</li>
          <li>고객 문의 응대 및 분쟁 처리</li>
          <li>서비스 개선 및 신규 서비스 개발</li>
          <li>라이브 방송 및 이벤트 알림 발송 (동의 시)</li>
        </ul>
      </Section>

      <Section title="3. 개인정보 보유 및 이용 기간">
        <div className="space-y-1.5">
          <Row label="회원 가입 정보" value="탈퇴 시까지" />
          <Row label="계약·청약철회 기록" value="5년 (전자상거래법)" />
          <Row label="대금 결제·공급 기록" value="5년 (전자상거래법)" />
          <Row label="소비자 불만·분쟁 기록" value="3년 (전자상거래법)" />
          <Row label="접속 로그 기록" value="3개월 (통신비밀보호법)" />
        </div>
      </Section>

      <Section title="4. 개인정보 제3자 제공">
        회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령의 규정 또는 상품
        배송을 위해 배송업체에 필요 최소한의 정보를 제공하는 경우 예외로 합니다.
      </Section>

      <Section title="5. 개인정보 처리 위탁">
        <div className="space-y-1.5">
          <Row label="카카오 (주)" value="소셜 로그인 인증" />
          <Row label="(주)비즈솔루션" value="서비스 호스팅·인프라" />
        </div>
      </Section>

      <Section title="6. 이용자의 권리">
        이용자는 언제든지 자신의 개인정보를 조회·수정하거나, 마이페이지 탈퇴를 통해 처리 동의를
        철회할 수 있습니다. 만 14세 미만 아동의 경우 법정대리인이 권리를 행사할 수 있습니다.
      </Section>

      <Section title="7. 개인정보 파기">
        보유 기간 경과 또는 처리 목적 달성 후 전자 파일은 복구 불가능한 방법으로 영구 삭제하며, 종이
        문서는 분쇄 또는 소각합니다.
      </Section>

      <Section title="8. 개인정보 보호책임자">
        <InfoBox label="책임자 · 연락처">김민성 · 422sss@live.com</InfoBox>
        <p className="mt-2">개인정보 침해 신고센터: privacy.kisa.or.kr (국번없이 118)</p>
      </Section>
    </>
  );
}

/* ── Shared helpers ─────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold text-white/90 border-l-2 border-[#FF007A] pl-2.5">
        {title}
      </h3>
      <div className="text-[11px] text-white/50 leading-relaxed pl-2.5">{children}</div>
    </div>
  );
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2.5">
      <p className="text-[10px] font-semibold text-white/60 mb-1">{label}</p>
      <p>{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[11px]">
      <span className="text-white/35 w-36 flex-shrink-0">{label}</span>
      <span className="text-white/60">{value}</span>
    </div>
  );
}
