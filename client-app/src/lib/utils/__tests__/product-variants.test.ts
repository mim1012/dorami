import {
  applyBulkVariantFields,
  buildColorSizeEditableVariants,
  convertVariantRowsPriceMode,
  createEmptyEditableVariant,
  deriveOptionSummaries,
  inferVariantPriceMode,
  normalizeEditableVariants,
  parseVariantOptionCsv,
  resolveSelectedVariant,
  serializeVariantsForSubmit,
  validateColorSizeVariants,
} from '../product-variants';

describe('product variant helpers', () => {
  it('creates an empty editable row', () => {
    expect(createEmptyEditableVariant()).toEqual({
      color: '',
      size: '',
      label: '',
      price: '',
      stock: '',
      status: 'ACTIVE',
    });
  });

  it('normalizes admin variant rows and derives option summaries', () => {
    const rows = [
      {
        color: ' Black ',
        size: ' M ',
        label: '',
        price: '31000',
        stock: '2',
        status: 'ACTIVE' as const,
      },
      {
        color: 'Ivory',
        size: 'L',
        label: '아이보리 / L',
        price: '33000',
        stock: '0',
        status: 'SOLD_OUT' as const,
      },
      { color: '', size: '', label: '', price: '', stock: '', status: 'ACTIVE' as const },
    ];

    expect(normalizeEditableVariants(rows)).toEqual([
      {
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        price: 31000,
        stock: 2,
        status: 'ACTIVE',
        sortOrder: 0,
      },
      {
        color: 'Ivory',
        size: 'L',
        label: '아이보리 / L',
        price: 33000,
        stock: 0,
        status: 'SOLD_OUT',
        sortOrder: 1,
      },
    ]);

    expect(deriveOptionSummaries(rows)).toEqual({
      colorOptions: ['Black', 'Ivory'],
      sizeOptions: ['M', 'L'],
      totalStock: 2,
      minPrice: 31000,
    });
  });

  it('parses option csv values by trimming, deduplicating, and removing blanks', () => {
    expect(parseVariantOptionCsv(' Black, Ivory , , Black , Navy ')).toEqual([
      'Black',
      'Ivory',
      'Navy',
    ]);
  });

  it('applies shared price and stock values across all variant rows', () => {
    expect(
      applyBulkVariantFields(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '1000',
            stock: '1',
            status: 'ACTIVE',
          },
          {
            color: 'Ivory',
            size: 'L',
            label: 'Ivory / L',
            price: '2500',
            stock: '3',
            status: 'SOLD_OUT',
          },
        ],
        { price: '1999', stock: '8' },
      ),
    ).toEqual([
      {
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        price: '1999',
        stock: '8',
        status: 'ACTIVE',
      },
      {
        color: 'Ivory',
        size: 'L',
        label: 'Ivory / L',
        price: '1999',
        stock: '8',
        status: 'SOLD_OUT',
      },
    ]);

    expect(
      applyBulkVariantFields(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '1000',
            stock: '1',
            status: 'ACTIVE',
          },
        ],
        { price: '', stock: '12' },
      ),
    ).toEqual([
      {
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        price: '1000',
        stock: '12',
        status: 'ACTIVE',
      },
    ]);
  });

  it('builds color/size cartesian rows and preserves existing combo state', () => {
    const rows = buildColorSizeEditableVariants({
      colors: ['Black', 'Ivory'],
      sizes: ['M', 'L'],
      basePrice: 29000,
      priceMode: 'ADD_ON',
      existingRows: [
        {
          id: 'variant-1',
          color: 'Black',
          size: 'M',
          label: '블랙 / M',
          price: '1500',
          stock: '3',
          status: 'SOLD_OUT',
        },
      ],
    });

    expect(rows).toEqual([
      {
        id: 'variant-1',
        color: 'Black',
        size: 'M',
        label: '블랙 / M',
        price: '1500',
        stock: '3',
        status: 'SOLD_OUT',
      },
      {
        color: 'Black',
        size: 'L',
        label: 'Black / L',
        price: '0',
        stock: '0',
        status: 'ACTIVE',
      },
      {
        color: 'Ivory',
        size: 'M',
        label: 'Ivory / M',
        price: '0',
        stock: '0',
        status: 'ACTIVE',
      },
      {
        color: 'Ivory',
        size: 'L',
        label: 'Ivory / L',
        price: '0',
        stock: '0',
        status: 'ACTIVE',
      },
    ]);
  });

  it('serializes add-on price rows into final variant prices', () => {
    expect(
      serializeVariantsForSubmit(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '0',
            stock: '5',
            status: 'ACTIVE',
          },
          {
            color: 'Black',
            size: 'L',
            label: 'Black / L',
            price: '2000',
            stock: '1',
            status: 'SOLD_OUT',
          },
        ],
        { basePrice: 29000, priceMode: 'ADD_ON' },
      ),
    ).toEqual([
      {
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        price: 29000,
        stock: 5,
        status: 'ACTIVE',
        sortOrder: 0,
      },
      {
        color: 'Black',
        size: 'L',
        label: 'Black / L',
        price: 31000,
        stock: 1,
        status: 'SOLD_OUT',
        sortOrder: 1,
      },
    ]);
  });

  it('converts price inputs between add-on and direct modes', () => {
    expect(
      convertVariantRowsPriceMode(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '0',
            stock: '5',
            status: 'ACTIVE',
          },
        ],
        { from: 'ADD_ON', to: 'DIRECT', basePrice: 29000 },
      ),
    ).toEqual([
      {
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        price: '29000',
        stock: '5',
        status: 'ACTIVE',
      },
    ]);
  });

  it('defaults existing persisted variants to direct pricing mode for safe edits', () => {
    expect(
      inferVariantPriceMode([
        { price: 29000, status: 'ACTIVE' as const },
        { price: 31000, status: 'ACTIVE' as const },
        { price: 32000, status: 'SOLD_OUT' as const },
      ] as any),
    ).toBe('DIRECT');

    expect(inferVariantPriceMode([] as any)).toBe('ADD_ON');
  });

  it('validates generated color/size rows before submit', () => {
    expect(
      validateColorSizeVariants([], {
        priceMode: 'ADD_ON',
        requireAtLeastOneCombination: true,
      }),
    ).toBe('색상 또는 사이즈 옵션을 입력해 조합을 하나 이상 만들어주세요.');

    expect(
      validateColorSizeVariants(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '',
            stock: '1',
            status: 'ACTIVE',
          },
        ],
        {
          priceMode: 'DIRECT',
          requireAtLeastOneCombination: true,
        },
      ),
    ).toBe('모든 옵션 조합의 가격을 입력해주세요.');

    expect(
      validateColorSizeVariants(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '-1',
            stock: '1',
            status: 'ACTIVE',
          },
        ],
        {
          priceMode: 'ADD_ON',
          requireAtLeastOneCombination: true,
        },
      ),
    ).toBe('옵션 추가금은 0 이상이어야 합니다.');

    expect(
      validateColorSizeVariants(
        [
          {
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: '29000',
            stock: '0',
            status: 'ACTIVE',
          },
        ],
        {
          priceMode: 'DIRECT',
          requireAtLeastOneCombination: true,
        },
      ),
    ).toBeNull();
  });

  it('resolves the selected active variant by color and size', () => {
    const product = {
      variants: [
        {
          id: 'variant-1',
          productId: 'product-1',
          color: 'Black',
          size: 'M',
          label: 'Black / M',
          price: 31000,
          stock: 2,
          status: 'ACTIVE' as const,
          sortOrder: 0,
          deletedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'variant-2',
          productId: 'product-1',
          color: 'Black',
          size: 'L',
          label: 'Black / L',
          price: 32000,
          stock: 0,
          status: 'SOLD_OUT' as const,
          sortOrder: 1,
          deletedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    expect(resolveSelectedVariant(product as any, 'Black', 'M')?.id).toBe('variant-1');
    expect(resolveSelectedVariant(product as any, 'Black', 'L')).toBeUndefined();
  });

  it('ignores soft-deleted variants when resolving the selected option', () => {
    const product = {
      variants: [
        {
          id: 'variant-deleted',
          productId: 'product-1',
          color: 'Black',
          size: 'M',
          label: 'Black / M',
          price: 31000,
          stock: 2,
          status: 'ACTIVE' as const,
          sortOrder: 0,
          deletedAt: '2024-01-02T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'variant-live',
          productId: 'product-1',
          color: 'Black',
          size: 'M',
          label: 'Black / M',
          price: 32000,
          stock: 1,
          status: 'ACTIVE' as const,
          sortOrder: 1,
          deletedAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
      ],
    };

    expect(resolveSelectedVariant(product as any, 'Black', 'M')?.id).toBe('variant-live');
  });
});
