'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-primary-black text-primary-text">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary-black/95 backdrop-blur-sm border-b border-border-color">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-content-bg transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5 text-primary-text" />
          </button>
          <h1 className="text-lg font-bold text-primary-text">개인정보 처리방침</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-16">
        <div className="text-xs text-secondary-text">
          <p>시행일: 2021년 10월 1일</p>
          <p>최종 수정일: 2024년 1월 1일</p>
        </div>

        <p className="text-xs text-secondary-text leading-relaxed">
          Doremi(이하 "회사")는 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등
          관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하게 처리하기 위해
          다음과 같이 개인정보 처리방침을 수립·공개합니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목">
          <p className="mb-2">회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.</p>
          <div className="space-y-2">
            <div className="bg-content-bg rounded-lg p-3">
              <p className="font-semibold text-primary-text/80 mb-1">
                필수 항목 (카카오 로그인 시)
              </p>
              <p>카카오 계정 ID, 닉네임, 프로필 이미지</p>
            </div>
            <div className="bg-content-bg rounded-lg p-3">
              <p className="font-semibold text-primary-text/80 mb-1">추가 수집 항목 (구매 시)</p>
              <p>배송지 주소(암호화 저장), 입금자명, 연락처</p>
            </div>
            <div className="bg-content-bg rounded-lg p-3">
              <p className="font-semibold text-primary-text/80 mb-1">자동 수집 항목</p>
              <p>IP 주소, 쿠키, 서비스 이용 기록, 기기 정보</p>
            </div>
          </div>
        </Section>

        <Section title="2. 개인정보 수집 및 이용 목적">
          <ul className="list-disc list-inside space-y-1">
            <li>회원 식별 및 서비스 제공</li>
            <li>주문 처리 및 배송</li>
            <li>고객 문의 응대 및 분쟁 처리</li>
            <li>서비스 개선 및 신규 서비스 개발</li>
            <li>라이브 방송 및 이벤트 알림 발송 (동의 시)</li>
            <li>법령 및 이용약관 위반 행위 방지</li>
          </ul>
        </Section>

        <Section title="3. 개인정보 보유 및 이용 기간">
          <p className="mb-2">
            회원 탈퇴 시 즉시 파기하는 것을 원칙으로 하며, 관련 법령에 따라 일정 기간 보관합니다.
          </p>
          <div className="space-y-2">
            <Row label="회원 가입 정보" value="탈퇴 시까지" />
            <Row label="계약·청약철회 기록" value="5년 (전자상거래법)" />
            <Row label="대금 결제·공급 기록" value="5년 (전자상거래법)" />
            <Row label="소비자 불만·분쟁 기록" value="3년 (전자상거래법)" />
            <Row label="접속 로그 기록" value="3개월 (통신비밀보호법)" />
          </div>
        </Section>

        <Section title="4. 개인정보 제3자 제공">
          <p className="mb-2">
            회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 다음의 경우 예외로
            합니다.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나 수사기관의 요청이 있는 경우</li>
            <li>상품 배송을 위해 배송업체에 배송 정보를 제공하는 경우</li>
          </ul>
        </Section>

        <Section title="5. 개인정보 처리 위탁">
          <p className="mb-2">회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.</p>
          <div className="space-y-2">
            <Row label="카카오 (주)" value="소셜 로그인 인증" />
            <Row label="(주)비즈솔루션" value="서비스 호스팅·인프라" />
          </div>
          <p className="mt-2">위탁 업체에 대해서는 관련 법령에 따른 관리·감독을 시행합니다.</p>
        </Section>

        <Section title="6. 이용자의 권리 및 행사 방법">
          <ol className="list-decimal list-inside space-y-1">
            <li>이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있습니다.</li>
            <li>개인정보 처리에 동의하지 않는 경우 탈퇴를 통해 동의를 철회할 수 있습니다.</li>
            <li>
              권리 행사는 서비스 내 마이페이지 또는 개인정보 보호책임자에게 이메일로 요청할 수
              있습니다.
            </li>
            <li>만 14세 미만 아동의 경우 법정대리인이 권리를 행사할 수 있습니다.</li>
          </ol>
        </Section>

        <Section title="7. 개인정보 파기 절차 및 방법">
          <ol className="list-decimal list-inside space-y-1">
            <li>개인정보는 보유 기간 경과 또는 처리 목적 달성 후 지체 없이 파기합니다.</li>
            <li>전자적 파일 형태: 복구·재생 불가능한 방법으로 영구 삭제합니다.</li>
            <li>종이 문서: 분쇄기로 분쇄하거나 소각합니다.</li>
          </ol>
        </Section>

        <Section title="8. 쿠키(Cookie) 운용">
          <ol className="list-decimal list-inside space-y-1">
            <li>회사는 서비스 향상을 위해 쿠키를 사용합니다.</li>
            <li>쿠키는 세션 유지, 로그인 상태 기억 등에 활용됩니다.</li>
            <li>
              브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 일부 서비스 이용이 제한될 수
              있습니다.
            </li>
          </ol>
        </Section>

        <Section title="9. 개인정보 보호책임자">
          <div className="bg-content-bg rounded-lg p-3 space-y-1.5">
            <Row label="책임자" value="김민성" />
            <Row label="연락처" value="422sss@live.com" />
            <Row label="기관" value="Doremi" />
          </div>
          <p className="mt-2">
            개인정보 처리에 관한 문의는 위 연락처로 접수하시면 신속하게 처리하겠습니다.
          </p>
          <p className="mt-1">
            개인정보 침해 신고는{' '}
            <span className="text-hot-pink">
              개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118)
            </span>
            에 문의하실 수 있습니다.
          </p>
        </Section>

        <div className="mt-8 pt-6 border-t border-border-color text-xs text-secondary-text/60 space-y-1">
          <p>상호명: Doremi</p>
          <p>대표자: 김민성</p>
          <p>사업자등록번호: 194-44-00522</p>
          <p>문의: 422sss@live.com</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-primary-text border-l-2 border-hot-pink pl-3">
        {title}
      </h2>
      <div className="text-xs text-secondary-text leading-relaxed pl-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-secondary-text/50 w-32 flex-shrink-0">{label}</span>
      <span className="text-primary-text/80">{value}</span>
    </div>
  );
}
