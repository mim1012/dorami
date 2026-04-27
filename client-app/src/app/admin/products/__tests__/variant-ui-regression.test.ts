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

  it('auto-enables edit modal variant UI for legacy products that only have color/size options', () => {
    expect(source).toContain(
      'const hasLegacyOptions = product.colorOptions.length > 0 || product.sizeOptions.length > 0;',
    );
    expect(source).toContain('variantEnabled: hasLegacyOptions');
    expect(source).toContain('buildColorSizeEditableVariants({');
  });
});
