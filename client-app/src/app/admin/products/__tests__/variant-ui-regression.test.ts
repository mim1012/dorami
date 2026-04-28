import fs from 'node:fs';
import path from 'node:path';

describe('Admin products variant pricing UI regression', () => {
  const pagePath = path.join(__dirname, '..', 'page.tsx');
  const source = fs.readFileSync(pagePath, 'utf8');

  it('keeps option pricing controls in the admin product form', () => {
    expect(source).toContain('옵션 가격 설정');
    expect(source).toContain('옵션별 개별 가격');
    expect(source).toContain('기본 가격 + 추가금');
    expect(source).toContain('variantPriceMode');
    expect(source).toContain('variantEnabled');
  });

  it('keeps bulk option apply controls for identical stock and price updates', () => {
    expect(source).toContain('전체 가격');
    expect(source).toContain('전체 재고');
    expect(source).toContain('입력값 전체 적용');
  });

  it('keeps a dedicated mobile variant editing layout in the product modal', () => {
    expect(source).toContain('lg:hidden');
    expect(source).toContain('모바일에서 옵션별 가격/재고를 빠르게 입력');
    expect(source).toContain('sticky bottom-0');
  });

  it('adds mobile-first quick actions and product cards to the page shell', () => {
    expect(source).toContain('모바일 빠른 액션');
    expect(source).toContain('카드형 상품 목록');
    expect(source).toContain('sm:hidden');
  });

  it('keeps selected-product bulk actions visible in a mobile bottom bar', () => {
    expect(source).toContain('선택한 상품');
    expect(source).toContain('모바일 일괄 작업');
    expect(source).toContain('sticky bottom-4');
  });
});
