'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
          <h1 className="text-lg font-bold text-primary-text">이용약관</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-16">
        <div className="text-xs text-secondary-text">
          <p>시행일: 2021년 10월 1일</p>
          <p>최종 수정일: 2024년 1월 1일</p>
        </div>

        <Section title="제1조 (목적)">
          이 약관은 Doremi(이하 "회사")가 운영하는 라이브 커머스 플랫폼 서비스(이하 "서비스")의
          이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을
          목적으로 합니다.
        </Section>

        <Section title="제2조 (정의)">
          <ol className="list-decimal list-inside space-y-1">
            <li>
              "서비스"란 회사가 제공하는 라이브 스트리밍 기반 전자상거래 플랫폼 및 이와 관련된 모든
              서비스를 의미합니다.
            </li>
            <li>"회원"이란 회사와 서비스 이용계약을 체결하고 회원 가입을 완료한 자를 말합니다.</li>
            <li>
              "라이브 방송"이란 판매자가 실시간으로 상품을 소개·판매하는 영상 서비스를 말합니다.
            </li>
            <li>
              "콘텐츠"란 서비스 내에서 제공되는 텍스트, 이미지, 영상 등 모든 디지털 정보를
              의미합니다.
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
              회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은
              시행일 7일 전부터 서비스 내 공지합니다.
            </li>
            <li>
              회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제4조 (서비스 제공)">
          <ol className="list-decimal list-inside space-y-1">
            <li>
              회사는 다음 서비스를 제공합니다.
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>실시간 라이브 방송 시청 서비스</li>
                <li>방송 중 상품 구매 서비스</li>
                <li>채팅 및 커뮤니케이션 서비스</li>
                <li>장바구니 및 주문 관리 서비스</li>
                <li>알림 및 공지사항 서비스</li>
              </ul>
            </li>
            <li>
              서비스는 연중무휴, 24시간 제공을 원칙으로 합니다. 단, 시스템 점검 등 불가피한 사유로
              서비스가 일시 중단될 수 있습니다.
            </li>
            <li>회사는 서비스의 내용을 변경하거나 종료할 수 있으며, 이 경우 사전에 공지합니다.</li>
          </ol>
        </Section>

        <Section title="제5조 (회원가입 및 탈퇴)">
          <ol className="list-decimal list-inside space-y-1">
            <li>
              이용자는 카카오 계정을 통해 회원가입을 신청할 수 있으며, 회사는 특별한 사유가 없는 한
              이를 수락합니다.
            </li>
            <li>만 14세 미만의 아동은 서비스를 이용할 수 없습니다.</li>
            <li>회원은 언제든지 서비스 내 마이페이지에서 탈퇴를 신청할 수 있습니다.</li>
            <li>
              탈퇴 시 진행 중인 주문, 미사용 포인트 등은 소멸될 수 있으며, 관련 법령에 따라 일정
              기간 보존될 수 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제6조 (회원의 의무)">
          <p className="mb-2">회원은 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>타인의 정보 도용 및 허위 정보 등록</li>
            <li>회사가 게시한 정보의 무단 변경</li>
            <li>회사 및 제3자의 저작권 등 지식재산권 침해</li>
            <li>채팅에서 욕설, 비방, 음란한 내용 게시</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>기타 관련 법령을 위반하는 행위</li>
          </ul>
        </Section>

        <Section title="제7조 (구매 및 결제)">
          <ol className="list-decimal list-inside space-y-1">
            <li>
              회원은 라이브 방송 중 또는 방송 종료 후 장바구니를 통해 상품을 구매할 수 있습니다.
            </li>
            <li>장바구니는 방송 종료 후 10분간 유지되며, 이후 자동 삭제됩니다.</li>
            <li>
              결제는 회사가 제공하는 결제 수단을 통해 이루어지며, 결제 전 상품 정보와 가격을
              확인하시기 바랍니다.
            </li>
            <li>결제 완료 후 주문 확인 문자/알림이 발송됩니다.</li>
          </ol>
        </Section>

        <Section title="제8조 (청약철회 및 환불)">
          <ol className="list-decimal list-inside space-y-1">
            <li>회원은 상품 수령일로부터 7일 이내에 청약철회를 신청할 수 있습니다.</li>
            <li>
              다음의 경우 청약철회가 제한될 수 있습니다.
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>회원의 사용 또는 일부 소비로 상품 가치가 현저히 감소한 경우</li>
                <li>시간 경과로 재판매가 어려운 경우</li>
                <li>복제 가능한 디지털 콘텐츠를 이미 제공받은 경우</li>
              </ul>
            </li>
            <li>환불은 청약철회 신청 확인 후 3영업일 이내에 처리됩니다.</li>
            <li>반품 배송비는 원칙적으로 회원이 부담하며, 상품 하자의 경우 회사가 부담합니다.</li>
          </ol>
        </Section>

        <Section title="제9조 (면책조항)">
          <ol className="list-decimal list-inside space-y-1">
            <li>회사는 천재지변, 불가항력적 사유로 인한 서비스 제공 불가 시 책임이 면제됩니다.</li>
            <li>회사는 회원의 귀책사유로 발생한 서비스 이용 장애에 대해 책임지지 않습니다.</li>
            <li>
              회사는 회원이 서비스를 통해 얻은 정보 또는 자료의 신뢰도, 정확성 등에 대한 책임을 지지
              않습니다.
            </li>
          </ol>
        </Section>

        <Section title="제10조 (분쟁 해결)">
          <ol className="list-decimal list-inside space-y-1">
            <li>서비스 이용과 관련한 분쟁은 회사와 회원 간의 상호 협의를 통해 해결합니다.</li>
            <li>
              협의가 이루어지지 않을 경우 관련 법령에 따라 관할 법원에 소를 제기할 수 있습니다.
            </li>
            <li>본 약관에 관한 소송의 관할 법원은 회사 소재지를 관할하는 법원으로 합니다.</li>
          </ol>
        </Section>

        <div className="mt-8 pt-6 border-t border-border-color text-xs text-secondary-text/60 space-y-1">
          <p>상호명: Doremi</p>
          <p>대표자: 김민성</p>
          <p>사업자등록번호: 194-44-00522</p>
          <p>통신판매업신고번호: 제 2021-대전유성-1024 호</p>
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
