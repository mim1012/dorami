import {
  createEmptyEditableVariant,
  deriveOptionSummaries,
  normalizeEditableVariants,
  resolveSelectedVariant,
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
