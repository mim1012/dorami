'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { apiClient } from '@/lib/api/client';
import { productKeys } from '@/lib/hooks/queries/use-products';
import { validateProductForm, type ProductFormErrors } from '@/lib/schemas/product';
import { formatPrice } from '@/lib/utils/price';
import {
  applyBulkValuesToEditableVariants,
  buildColorSizeEditableVariants,
  createEmptyEditableVariant,
  deriveOptionSummaries,
  parseVariantOptionCsv,
  serializeVariantsForSubmit,
  validateColorSizeVariants,
  type EditableProductVariant,
  type VariantPriceMode,
} from '@/lib/utils/product-variants';
import {
  buildImportPreview,
  inferColumnMapping,
  parseExcelFile,
  UNMAPPED_COLUMN,
  type ImportColumnMapping,
  type ParsedExcelSheet,
} from '@/lib/utils/product-import';
import {
  Plus,
  Edit,
  Trash2,
  Package,
  AlertCircle,
  Upload,
  X,
  CheckCircle,
  Timer,
  GripVertical,
  Search,
} from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Product as BaseProduct } from '@/lib/types';

interface Product extends BaseProduct {
  images?: string[];
  sortOrder?: number;
  expiresAt?: string | null;
}

interface ProductFormData {
  streamKey: string;
  name: string;
  originalPrice: string; // 정가 (항상 입력)
  discountEnabled: boolean; // 할인 토글
  discountPrice: string; // 할인가 (discountEnabled=true 일 때만)
  stock: string;
  status: 'AVAILABLE' | 'SOLD_OUT';
  variantEnabled: boolean;
  variantPriceMode: VariantPriceMode;
  colorOptions: string;
  sizeOptions: string;
  variants: EditableProductVariant[];
  timerEnabled: boolean;
  timerDurationHours: string;
  imageUrl: string;
  images: string[];
  isNew: boolean;
  expiresAtHours?: string;
}

const MIN_TIMER_HOURS = 1;
const MAX_TIMER_HOURS = 120; // 5 days
const MINUTES_PER_HOUR = 60;

function minutesToHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return MIN_TIMER_HOURS;
  }
  return Math.max(MIN_TIMER_HOURS, Math.ceil(minutes / MINUTES_PER_HOUR));
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

function getCurrentSellingPrice(formData: Pick<ProductFormData, 'originalPrice'>) {
  const parsed = Number.parseFloat(formData.originalPrice);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapProductToVariantEditorState(product: Product): {
  variantEnabled: boolean;
  variantPriceMode: VariantPriceMode;
  variants: EditableProductVariant[];
} {
  if (!product.variants || product.variants.length === 0) {
    return {
      variantEnabled: false,
      variantPriceMode: 'DIRECT',
      variants: [createEmptyEditableVariant()],
    };
  }

  return {
    variantEnabled: true,
    variantPriceMode: 'DIRECT',
    variants: product.variants.map((variant) => ({
      id: variant.id,
      color: variant.color ?? '',
      size: variant.size ?? '',
      label: variant.label ?? '',
      price: String(variant.price),
      stock: String(variant.stock),
      status: variant.status,
    })),
  };
}

async function resizeImage(file: File, maxWidth = 800, maxHeight = 800): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          resolve(
            new File([blob!], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }),
          );
        },
        'image/webp',
        0.85,
      );
    };
    img.src = url;
  });
}

// --- Sortable Row Component ---
function SortableRow({
  product,
  selectedIds,
  toggleSelect,
  formatPrice,
  getStatusBadge,
  handleOpenModal,
  handleMarkAsSoldOut,
  handleDelete,
}: {
  product: Product;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => { text: string; color: string };
  handleOpenModal: (product?: Product) => void;
  handleMarkAsSoldOut: (id: string) => void;
  handleDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusBadge = getStatusBadge(product.status);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 transition-colors ${selectedIds.has(product.id) ? 'bg-hot-pink/5' : ''}`}
    >
      <td className="px-2 py-4 w-8">
        <button
          className="inline-flex cursor-grab active:cursor-grabbing min-h-[44px] min-w-[44px] items-center justify-center p-2 text-secondary-text hover:text-primary-text"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-2 py-4 w-10">
        <input
          type="checkbox"
          checked={selectedIds.has(product.id)}
          onChange={() => toggleSelect(product.id)}
          className="w-5 h-5 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
        />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center">
              <Package className="w-6 h-6 text-secondary-text opacity-30" />
            </div>
          )}
          <div>
            <Body className="text-primary-text font-semibold">{product.name}</Body>
            <div className="flex gap-2 mt-1">
              {Array.isArray(product.colorOptions) && product.colorOptions.length > 0 && (
                <span className="text-xs bg-info/20 text-info px-2 py-0.5 rounded">
                  색상: {product.colorOptions.join(', ')}
                </span>
              )}
              {Array.isArray(product.sizeOptions) && product.sizeOptions.length > 0 && (
                <span className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded">
                  사이즈: {product.sizeOptions.join(', ')}
                </span>
              )}
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                재고: {product.stock}개
              </span>
              {product.timerEnabled && (
                <span className="text-xs bg-hot-pink/20 text-hot-pink px-2 py-0.5 rounded">
                  <Timer className="w-4 h-4 inline-block mr-1" aria-hidden="true" />{' '}
                  {minutesToHours(product.timerDuration)}시간
                </span>
              )}
              {product.expiresAt &&
                (() => {
                  const expiresAt = new Date(product.expiresAt!);
                  const diffMs = expiresAt.getTime() - Date.now();
                  if (diffMs <= 0) return null;
                  const isSoon = diffMs < 60 * 60 * 1000;
                  const label =
                    expiresAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) +
                    ' ' +
                    expiresAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <span
                      key="expiry"
                      className={`text-xs px-2 py-0.5 rounded ${isSoon ? 'bg-error/20 text-error' : 'bg-orange-500/20 text-orange-400'}`}
                    >
                      {label}
                    </span>
                  );
                })()}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        {product.originalPrice != null && product.originalPrice > product.price ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-secondary-text line-through">
              {formatPrice(product.originalPrice)}
            </span>
            <div className="flex items-center gap-1.5">
              <Body className="text-primary-text font-bold">{formatPrice(product.price)}</Body>
              {(() => {
                const rate =
                  Math.round(
                    ((product.originalPrice - product.price) / product.originalPrice) * 1000,
                  ) / 10;
                return (
                  <span className="text-xs bg-error/20 text-error px-1.5 py-0.5 rounded font-semibold">
                    -{rate}%
                  </span>
                );
              })()}
            </div>
          </div>
        ) : (
          <div>
            <Body className="text-primary-text font-bold">{formatPrice(product.price)}</Body>
            {product.shippingFee > 0 && (
              <Body className="text-xs text-secondary-text">
                +배송비 {formatPrice(product.shippingFee)}
              </Body>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-center">
        <Body className={`font-semibold ${product.stock < 5 ? 'text-error' : 'text-primary-text'}`}>
          {product.stock}개
        </Body>
      </td>
      <td className="px-4 py-4 text-center">
        <Body className="text-primary-text text-sm">{formatDate(product.createdAt)}</Body>
      </td>
      <td className="px-4 py-4 text-center">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusBadge.color}`}
        >
          {statusBadge.text}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handleOpenModal(product)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-lg transition-colors text-hot-pink"
            title="수정"
          >
            <Edit className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">수정</span>
          </button>
          {product.status === 'AVAILABLE' && (
            <button
              onClick={() => handleMarkAsSoldOut(product.id)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-lg transition-colors text-warning"
              title="품절 처리"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="ml-1 hidden sm:inline">품절</span>
            </button>
          )}
          <button
            onClick={() => handleDelete(product.id)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-lg transition-colors text-error"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">삭제</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobileProductCard({
  product,
  selectedIds,
  toggleSelect,
  formatPrice,
  getStatusBadge,
  handleOpenModal,
  handleMarkAsSoldOut,
  handleDelete,
}: {
  product: Product;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => { text: string; color: string };
  handleOpenModal: (product?: Product) => void;
  handleMarkAsSoldOut: (id: string) => void;
  handleDelete: (id: string) => void;
}) {
  const statusBadge = getStatusBadge(product.status);

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm transition-colors ${
        selectedIds.has(product.id)
          ? 'border-hot-pink/40 bg-hot-pink/5'
          : 'border-gray-200 bg-content-bg'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selectedIds.has(product.id)}
          onChange={() => toggleSelect(product.id)}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-hot-pink focus:ring-hot-pink"
        />

        <div className="flex-1 space-y-3">
          <div className="flex items-start gap-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-white">
                <Package className="h-7 w-7 text-secondary-text opacity-30" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Body className="font-semibold text-primary-text">{product.name}</Body>
                  <p className="mt-1 text-xs text-secondary-text">
                    등록일 {formatDate(product.createdAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge.color}`}
                >
                  {statusBadge.text}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {Array.isArray(product.colorOptions) && product.colorOptions.length > 0 && (
                  <span className="rounded-full bg-info/20 px-2 py-0.5 text-xs text-info">
                    색상 {product.colorOptions.join(', ')}
                  </span>
                )}
                {Array.isArray(product.sizeOptions) && product.sizeOptions.length > 0 && (
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-500">
                    사이즈 {product.sizeOptions.join(', ')}
                  </span>
                )}
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                  재고 {product.stock}개
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/70 p-3">
            {product.originalPrice != null && product.originalPrice > product.price ? (
              <div className="space-y-1">
                <span className="text-xs text-secondary-text line-through">
                  {formatPrice(product.originalPrice)}
                </span>
                <div className="flex items-center gap-2">
                  <Body className="font-bold text-primary-text">{formatPrice(product.price)}</Body>
                  <span className="rounded bg-error/20 px-1.5 py-0.5 text-xs font-semibold text-error">
                    -
                    {Math.round(
                      ((product.originalPrice - product.price) / product.originalPrice) * 1000,
                    ) / 10}
                    %
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <Body className="font-bold text-primary-text">{formatPrice(product.price)}</Body>
                {product.shippingFee > 0 && (
                  <Body className="text-xs text-secondary-text">
                    +배송비 {formatPrice(product.shippingFee)}
                  </Body>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleOpenModal(product)} className="w-full">
              수정
            </Button>
            {product.status === 'AVAILABLE' ? (
              <Button
                variant="outline"
                onClick={() => handleMarkAsSoldOut(product.id)}
                className="w-full border-warning text-warning hover:bg-warning/10"
              >
                품절 처리
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleDelete(product.id)}
                className="w-full border-error text-error hover:bg-error/10"
              >
                삭제
              </Button>
            )}
          </div>

          {product.status === 'AVAILABLE' && (
            <Button
              variant="outline"
              onClick={() => handleDelete(product.id)}
              className="w-full border-error text-error hover:bg-error/10"
            >
              삭제
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function AdminProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirmAction = useConfirm();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStreamKey, setFilterStreamKey] = useState<string>('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'AVAILABLE' | 'SOLD_OUT'>('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [activeLiveStreamKey, setActiveLiveStreamKey] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Gallery images state
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [parsedExcel, setParsedExcel] = useState<ParsedExcelSheet | null>(null);
  const [importMapping, setImportMapping] = useState<ImportColumnMapping>({
    productName: UNMAPPED_COLUMN,
    option: UNMAPPED_COLUMN,
    price: UNMAPPED_COLUMN,
    stock: UNMAPPED_COLUMN,
  });
  const [defaultImportStock, setDefaultImportStock] = useState('1');
  const [defaultImportPrice, setDefaultImportPrice] = useState('');
  const [bulkImportHideUntilRelease, setBulkImportHideUntilRelease] = useState(true);
  const [variantBulkPrice, setVariantBulkPrice] = useState('');
  const [variantBulkStock, setVariantBulkStock] = useState('');

  const [formData, setFormData] = useState<ProductFormData>({
    streamKey: '',
    name: '',
    originalPrice: '',
    discountEnabled: false,
    discountPrice: '',
    stock: '',
    status: 'AVAILABLE',
    variantEnabled: false,
    variantPriceMode: 'ADD_ON',
    colorOptions: '',
    sizeOptions: '',
    variants: [createEmptyEditableVariant()],
    timerEnabled: false,
    timerDurationHours: '1',
    imageUrl: '',
    images: [],
    isNew: false,
    expiresAtHours: undefined,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchProducts();
  }, [filterStreamKey]);

  // Fetch active live stream key to pre-populate product form
  useEffect(() => {
    const fetchActiveLiveKey = async () => {
      try {
        const response = await apiClient.get<{ isLive: boolean; streamKey: string | null }>(
          '/streaming/live-status',
        );
        if (response.data.isLive && response.data.streamKey) {
          setActiveLiveStreamKey(response.data.streamKey);
        }
      } catch {
        // Non-critical — form still works without it
      }
    };
    fetchActiveLiveKey();
  }, []);

  const parsedColorOptions = useMemo(
    () => parseVariantOptionCsv(formData.colorOptions),
    [formData.colorOptions],
  );
  const parsedSizeOptions = useMemo(
    () => parseVariantOptionCsv(formData.sizeOptions),
    [formData.sizeOptions],
  );
  const currentSellingPrice = useMemo(() => getCurrentSellingPrice(formData), [formData]);

  useEffect(() => {
    if (!formData.variantEnabled) {
      return;
    }

    const nextVariants = buildColorSizeEditableVariants({
      colors: parsedColorOptions,
      sizes: parsedSizeOptions,
      existingRows: formData.variants,
      priceMode: formData.variantPriceMode,
      basePrice: currentSellingPrice,
    });

    const hasChanged = JSON.stringify(nextVariants) !== JSON.stringify(formData.variants);

    if (hasChanged) {
      setFormData((prev) => ({ ...prev, variants: nextVariants }));
    }
  }, [
    currentSellingPrice,
    formData.variantEnabled,
    formData.variantPriceMode,
    formData.variants,
    parsedColorOptions,
    parsedSizeOptions,
  ]);

  const variantPreviewRows = useMemo(() => {
    if (!formData.variantEnabled) {
      return [] as Array<{ color: string; size: string; label: string }>;
    }

    return buildColorSizeEditableVariants({
      colors: parsedColorOptions,
      sizes: parsedSizeOptions,
      existingRows: formData.variants,
      priceMode: formData.variantPriceMode,
      basePrice: currentSellingPrice,
    }).map((variant) => ({
      color: variant.color ?? '',
      size: variant.size ?? '',
      label:
        variant.label || [variant.color, variant.size].filter(Boolean).join(' / ') || '기본 옵션',
    }));
  }, [
    currentSellingPrice,
    formData.variantEnabled,
    formData.variantPriceMode,
    formData.variants,
    parsedColorOptions,
    parsedSizeOptions,
  ]);

  const adminVariantSummary = useMemo(() => {
    if (!formData.variantEnabled) {
      return null;
    }

    return deriveOptionSummaries(formData.variants);
  }, [formData.variantEnabled, formData.variants]);

  useEffect(() => {
    if (!formData.variantEnabled || !adminVariantSummary) {
      return;
    }

    const nextStock = String(adminVariantSummary.totalStock);
    if (formData.stock !== nextStock) {
      setFormData((prev) => ({ ...prev, stock: nextStock }));
    }
  }, [adminVariantSummary, formData.stock, formData.variantEnabled]);

  // Client-side filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (priceMin && p.price < parseFloat(priceMin)) return false;
      if (priceMax && p.price > parseFloat(priceMax)) return false;
      return true;
    });
  }, [products, searchQuery, filterStatus, priceMin, priceMax]);

  const importPreview = useMemo(() => {
    if (!parsedExcel) {
      return { products: [], warnings: [], errors: [] };
    }

    return buildImportPreview({
      parsed: parsedExcel,
      mapping: importMapping,
      defaultStock: defaultImportStock,
      defaultPrice: defaultImportPrice,
    });
  }, [parsedExcel, importMapping, defaultImportPrice, defaultImportStock]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('includeExpired', 'true');
      if (filterStreamKey) {
        params.set('streamKey', filterStreamKey);
      }
      const url = `/products/admin${params.toString() ? `?${params}` : ''}`;
      const response = await apiClient.get(url);
      setProducts((response.data as Product[]) || []);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- DnD Reorder ---
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const isFiltered = !!(searchQuery || filterStatus || priceMin || priceMax);

    let reordered: Product[];
    if (isFiltered) {
      const oldIndex = filteredProducts.findIndex((p) => p.id === active.id);
      const newIndex = filteredProducts.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedFiltered = arrayMove(filteredProducts, oldIndex, newIndex);
      const filteredIds = reorderedFiltered.map((p) => p.id);
      reordered = [...products];
      let fi = 0;
      for (let i = 0; i < reordered.length; i++) {
        if (filteredIds.includes(reordered[i].id)) {
          reordered[i] = reorderedFiltered[fi++];
        }
      }
    } else {
      const oldIndex = products.findIndex((p) => p.id === active.id);
      const newIndex = products.findIndex((p) => p.id === over.id);
      reordered = arrayMove(products, oldIndex, newIndex);
    }

    setProducts(reordered);

    try {
      await apiClient.patch('/products/reorder', { ids: reordered.map((p) => p.id) });
    } catch (err: any) {
      console.error('Failed to reorder products:', err);
      showToast('순서 변경에 실패했습니다.', 'error');
      fetchProducts();
    }
  };

  // --- Bulk Status Change ---
  const handleBulkStatusChange = async (status: 'AVAILABLE' | 'SOLD_OUT') => {
    if (selectedIds.size === 0) return;
    const label = status === 'AVAILABLE' ? '판매중' : '품절';
    const confirmed = await confirmAction({
      title: '상태 일괄 변경',
      message: `선택한 ${selectedIds.size}개 상품을 "${label}"으로 변경하시겠습니까?`,
      confirmText: '변경',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      await apiClient.post('/products/bulk-status', {
        ids: Array.from(selectedIds),
        status,
      });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      showToast(`${selectedIds.size}개 상품이 "${label}"으로 변경되었습니다.`, 'success');
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      console.error('Bulk status change failed:', err);
      showToast(`상태 변경에 실패했습니다: ${err.message}`, 'error');
    }
  };

  const resetImportState = () => {
    setImportFileName('');
    setParsedExcel(null);
    setImportMapping({
      productName: UNMAPPED_COLUMN,
      option: UNMAPPED_COLUMN,
      price: UNMAPPED_COLUMN,
      stock: UNMAPPED_COLUMN,
    });
    setDefaultImportStock('1');
    setDefaultImportPrice('');
    setBulkImportHideUntilRelease(true);
  };

  const handleCloseImportModal = () => {
    if (isImporting) return;
    setIsImportModalOpen(false);
    resetImportState();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      setParsedExcel(parsed);
      setImportFileName(file.name);
      setImportMapping(inferColumnMapping(parsed.headers));
      showToast(`엑셀을 읽었습니다. 시트: ${parsed.sheetName}`, 'success');
    } catch (err: any) {
      console.error('Failed to parse excel file:', err);
      showToast(err?.message || '엑셀 파일을 읽지 못했습니다.', 'error');
      resetImportState();
    } finally {
      e.target.value = '';
    }
  };

  const handleImportMappingChange = (field: keyof ImportColumnMapping, value: string) => {
    setImportMapping((prev) => ({ ...prev, [field]: value }));
  };

  const handleImportProducts = async () => {
    if (!parsedExcel) {
      showToast('먼저 엑셀 파일을 업로드해주세요.', 'error');
      return;
    }
    if (!formData.streamKey.trim()) {
      showToast('업로드할 Stream Key를 먼저 입력해주세요.', 'error');
      return;
    }
    if (importPreview.errors.length > 0) {
      showToast(importPreview.errors[0], 'error');
      return;
    }
    if (importPreview.products.length === 0) {
      showToast('등록할 수 있는 상품이 없습니다.', 'error');
      return;
    }

    setIsImporting(true);
    try {
      for (const product of importPreview.products) {
        await apiClient.post('/products', {
          streamKey: formData.streamKey.trim(),
          name: product.name,
          price: product.price,
          stock: product.stock,
          colorOptions: product.optionValues,
          sizeOptions: [],
          status: bulkImportHideUntilRelease ? 'SOLD_OUT' : 'AVAILABLE',
          excludeFromStore: bulkImportHideUntilRelease,
        });
      }

      queryClient.invalidateQueries({ queryKey: productKeys.all });
      await fetchProducts();
      showToast(`${importPreview.products.length}개 상품을 업로드했습니다.`, 'success');
      handleCloseImportModal();
    } catch (err: any) {
      console.error('Failed to import products:', err);
      showToast(`대량 업로드에 실패했습니다: ${err?.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // --- Image Upload ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      const resized = await resizeImage(file);
      setSelectedFile(resized);
      const objectUrl = URL.createObjectURL(resized);
      setPreviewUrl(objectUrl);
    }
  };

  const uploadSingleImage = async (file: File): Promise<string> => {
    const formDataToUpload = new FormData();
    formDataToUpload.append('file', file);
    const result = await apiClient.post<{ url: string }>('/upload/image', formDataToUpload);
    return result.data.url;
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadSingleImage(selectedFile);
      setFormData((prev) => ({ ...prev, imageUrl }));
      showToast('이미지가 업로드되었습니다!', 'success');
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      showToast('이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
  };

  // --- Gallery Image Upload ---
  const handleGalleryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const resized = await Promise.all(files.map((f) => resizeImage(f)));
      setGalleryFiles(resized);
    }
  };

  const handleGalleryUpload = async () => {
    if (galleryFiles.length === 0) return;

    setIsUploadingGallery(true);
    try {
      const urls: string[] = [];
      for (const file of galleryFiles) {
        const url = await uploadSingleImage(file);
        urls.push(url);
      }
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      setGalleryFiles([]);
      showToast(`${urls.length}개 이미지가 업로드되었습니다!`, 'success');
    } catch (err: any) {
      console.error('Failed to upload gallery images:', err);
      showToast('갤러리 이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleVariantFieldChange = (
    index: number,
    field: keyof EditableProductVariant,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, rowIndex) =>
        rowIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  };

  const handleApplyVariantBulkValues = () => {
    const nextPrice = variantBulkPrice.trim();
    const nextStock = variantBulkStock.trim();

    if (!nextPrice && !nextStock) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      variants: applyBulkValuesToEditableVariants(prev.variants, {
        price: nextPrice || undefined,
        stock: nextStock || undefined,
      }),
    }));
  };

  // --- Modal Close ---
  const handleCloseModal = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSelectedFile(null);
    setGalleryFiles([]);
    setVariantBulkPrice('');
    setVariantBulkStock('');
    setEditingProduct(null);
    setFormErrors({});
    setIsModalOpen(false);
  };

  // --- Modal Open ---
  const handleOpenModal = (product?: Product) => {
    setVariantBulkPrice('');
    setVariantBulkStock('');

    if (product) {
      setEditingProduct(product);
      const hasDiscount = product.originalPrice != null && product.originalPrice > product.price;
      const variantEditorState = mapProductToVariantEditorState(product);
      setFormData({
        streamKey: product.streamKey || '',
        name: product.name,
        originalPrice: product.price.toString(),
        discountEnabled: false,
        discountPrice: '',
        stock: product.stock.toString(),
        status: product.status,
        variantEnabled: variantEditorState.variantEnabled,
        variantPriceMode: variantEditorState.variantPriceMode,
        colorOptions: product.colorOptions.join(', '),
        sizeOptions: product.sizeOptions.join(', '),
        variants: variantEditorState.variants,
        timerEnabled: product.timerEnabled,
        timerDurationHours: minutesToHours(product.timerDuration).toString(),
        imageUrl: product.imageUrl || '',
        images: product.images || [],
        isNew: product.isNew || false,
        expiresAtHours: product.expiresAt
          ? String(
              Math.max(
                1,
                Math.ceil((new Date(product.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)),
              ),
            )
          : undefined,
      });
      setPreviewUrl(product.imageUrl || '');
    } else {
      setEditingProduct(null);
      setFormData({
        streamKey: activeLiveStreamKey,
        name: '',
        originalPrice: '',
        discountEnabled: false,
        discountPrice: '',
        stock: '',
        status: 'AVAILABLE',
        variantEnabled: false,
        variantPriceMode: 'DIRECT',
        colorOptions: '',
        sizeOptions: '',
        variants: [createEmptyEditableVariant()],
        timerEnabled: false,
        timerDurationHours: '1',
        imageUrl: '',
        images: [],
        isNew: false,
        expiresAtHours: undefined,
      });
      setPreviewUrl('');
    }
    setSelectedFile(null);
    setGalleryFiles([]);
    setIsModalOpen(true);
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build schema-compatible data for validation
    const dataForValidation = {
      ...formData,
      // schema expects discountPrice optional when discountEnabled=false
      discountPrice: formData.discountEnabled ? formData.discountPrice : undefined,
    };

    const errors = validateProductForm(dataForValidation as any);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setIsSubmitting(true);

    try {
      // Auto-upload main image if file selected but not yet uploaded
      let finalImageUrl = formData.imageUrl;
      if (selectedFile && !formData.imageUrl) {
        setIsUploading(true);
        try {
          finalImageUrl = await uploadSingleImage(selectedFile);
          setFormData((prev) => ({ ...prev, imageUrl: finalImageUrl }));
        } catch {
          showToast('이미지 업로드에 실패했습니다.', 'error');
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Auto-upload pending gallery files
      let finalImages = formData.images;
      if (galleryFiles.length > 0) {
        setIsUploadingGallery(true);
        try {
          const urls: string[] = [];
          for (const file of galleryFiles) {
            const url = await uploadSingleImage(file);
            urls.push(url);
          }
          finalImages = [...formData.images, ...urls];
          setFormData((prev) => ({ ...prev, images: finalImages }));
          setGalleryFiles([]);
        } catch {
          showToast('갤러리 이미지 업로드에 실패했습니다.', 'error');
          setIsSubmitting(false);
          setIsUploadingGallery(false);
          return;
        } finally {
          setIsUploadingGallery(false);
        }
      }

      // Build API payload from new form shape
      let apiPrice: number;
      let apiOriginalPrice: number | undefined;
      let apiDiscountRate: number | undefined;

      if (formData.discountEnabled && formData.discountPrice) {
        const orig = parseFloat(formData.originalPrice);
        const disc = parseFloat(formData.discountPrice);
        apiPrice = disc;
        apiOriginalPrice = orig;
        apiDiscountRate = Math.round(((orig - disc) / orig) * 1000) / 10;
      } else {
        apiPrice = parseFloat(formData.originalPrice);
        apiOriginalPrice = undefined;
        apiDiscountRate = undefined;
      }

      const normalizedVariants = formData.variantEnabled
        ? serializeVariantsForSubmit(formData.variants, {
            priceMode: formData.variantPriceMode,
            basePrice: currentSellingPrice,
          })
        : [];

      const variantValidationError = formData.variantEnabled
        ? validateColorSizeVariants(formData.variants, {
            priceMode: formData.variantPriceMode,
            requireAtLeastOneCombination: true,
          })
        : null;

      if (variantValidationError) {
        setFormErrors((prev) => ({
          ...prev,
          colorOptions: prev.colorOptions ?? variantValidationError,
          sizeOptions: prev.sizeOptions ?? variantValidationError,
        }));
        showToast(variantValidationError, 'error');
        setIsSubmitting(false);
        return;
      }

      const variantSummary =
        normalizedVariants.length > 0
          ? deriveOptionSummaries(
              normalizedVariants.map((variant) => ({
                id: variant.id,
                color: variant.color ?? '',
                size: variant.size ?? '',
                label: variant.label ?? '',
                price: String(variant.price),
                stock: String(variant.stock),
                status: variant.status,
              })),
            )
          : null;

      const shouldSendVariants = formData.variantEnabled || Boolean(editingProduct);

      const basePayload = {
        name: formData.name,
        price: variantSummary?.minPrice ?? apiPrice,
        stock: variantSummary?.totalStock ?? parseInt(formData.stock),
        colorOptions: formData.variantEnabled ? (variantSummary?.colorOptions ?? []) : [],
        sizeOptions: formData.variantEnabled ? (variantSummary?.sizeOptions ?? []) : [],
        ...(shouldSendVariants ? { variants: normalizedVariants } : {}),
        status: formData.status,
        timerEnabled: formData.timerEnabled,
        timerDuration:
          Math.min(
            MAX_TIMER_HOURS,
            Math.max(
              MIN_TIMER_HOURS,
              parseInt(formData.timerDurationHours || `${MIN_TIMER_HOURS}`, 10) || MIN_TIMER_HOURS,
            ),
          ) * MINUTES_PER_HOUR,
        imageUrl: finalImageUrl || undefined,
        images: finalImages,
        discountRate: apiDiscountRate,
        originalPrice: apiOriginalPrice,
        isNew: formData.isNew,
        ...(formData.expiresAtHours && {
          expiresAt: new Date(
            Date.now() + parseInt(formData.expiresAtHours, 10) * 60 * 60 * 1000,
          ).toISOString(),
        }),
      };

      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, basePayload);
      } else {
        await apiClient.post('/products', {
          streamKey: formData.streamKey.trim() || undefined,
          ...basePayload,
        });
      }

      queryClient.invalidateQueries({ queryKey: productKeys.all });
      fetchProducts();
      handleCloseModal();
      showToast(editingProduct ? '상품이 수정되었습니다!' : '상품이 등록되었습니다!', 'success');
    } catch (err: any) {
      console.error('Failed to save product:', err);
      showToast(`상품 저장에 실패했습니다: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsSoldOut = async (productId: string) => {
    const confirmed = await confirmAction({
      title: '품절 처리',
      message: '이 상품을 품절 처리하시겠습니까?',
      confirmText: '품절 처리',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      await apiClient.patch(`/products/${productId}/sold-out`, {});
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      fetchProducts();
      showToast('상품이 품절 처리되었습니다.', 'success');
    } catch (err: any) {
      console.error('Failed to mark as sold out:', err);
      showToast('품절 처리에 실패했습니다.', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirmAction({
      title: '일괄 삭제',
      message: `선택한 ${selectedIds.size}개의 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const result = await apiClient.post<{ deleted: number; failed: string[] }>(
        '/products/bulk-delete',
        { ids: Array.from(selectedIds) },
      );
      const { deleted, failed } = result.data;
      if (failed.length > 0) {
        showToast(`${deleted}개 삭제 완료, ${failed.length}개 실패`, 'info');
      } else {
        showToast(`${deleted}개 상품이 삭제되었습니다.`, 'success');
      }
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      showToast(`일괄 삭제에 실패했습니다: ${err.message}`, 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    const confirmed = await confirmAction({
      title: '상품 삭제',
      message: '정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiClient.delete(`/products/${productId}`);
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      fetchProducts();
      showToast('상품이 삭제되었습니다.', 'success');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      showToast(`상품 삭제에 실패했습니다: ${err.message}`, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return { text: '판매중', color: 'bg-success/20 text-success' };
      case 'SOLD_OUT':
        return { text: '품절', color: 'bg-error/20 text-error' };
      default:
        return { text: status, color: 'bg-gray-500/20 text-gray-500' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Body className="text-secondary-text">상품 목록을 불러오는 중...</Body>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 sm:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary-text mb-2">상품 관리</h1>
          <p className="text-secondary-text">라이브에서 판매할 상품을 등록하고 관리하세요</p>
        </div>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleBulkStatusChange('AVAILABLE')}
                size="sm"
                className="flex items-center gap-2 border-success text-success hover:bg-success/10"
              >
                판매중으로 변경
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkStatusChange('SOLD_OUT')}
                size="sm"
                className="flex items-center gap-2 border-warning text-warning hover:bg-warning/10"
              >
                품절로 변경
              </Button>
              <Button
                variant="outline"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                size="sm"
                className="flex items-center gap-2 border-error text-error hover:bg-error/10"
              >
                <Trash2 className="w-4 h-4" />
                {isBulkDeleting ? '삭제 중...' : `${selectedIds.size}개 삭제`}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            엑셀 업로드
          </Button>
          <Button
            variant="primary"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            상품 등록
          </Button>
        </div>
      </div>

      <div className="rounded-card border border-gray-200 bg-content-bg p-4 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Body className="font-semibold text-primary-text">모바일 빠른 액션</Body>
            <p className="mt-1 text-xs text-secondary-text">
              자주 쓰는 등록/업로드 작업을 먼저 배치했습니다.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-secondary-text">
            총 {filteredProducts.length}개
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="flex w-full items-center justify-center gap-2"
          >
            <Upload className="h-4 w-4" />
            엑셀 업로드
          </Button>
          <Button
            variant="primary"
            onClick={() => handleOpenModal()}
            className="flex w-full items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            상품 등록
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-card border border-hot-pink/20 bg-content-bg p-4 shadow-sm sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Body className="font-semibold text-primary-text">선택한 상품 {selectedIds.size}개</Body>
              <p className="mt-1 text-xs text-secondary-text">모바일 일괄 작업</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="shrink-0"
            >
              선택 해제
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusChange('AVAILABLE')}
              className="border-success text-success hover:bg-success/10"
            >
              판매중
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusChange('SOLD_OUT')}
              className="border-warning text-warning hover:bg-warning/10"
            >
              일괄 품절
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="border-error text-error hover:bg-error/10"
            >
              {isBulkDeleting ? '삭제 중' : '삭제'}
            </Button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-content-bg border border-gray-200 rounded-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="상품명으로 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hot-pink/30 focus:border-hot-pink"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as '' | 'AVAILABLE' | 'SOLD_OUT')}
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hot-pink/30 focus:border-hot-pink"
          >
            <option value="">전체 상태</option>
            <option value="AVAILABLE">판매중</option>
            <option value="SOLD_OUT">품절</option>
          </select>
          <Input
            placeholder="최소 가격"
            type="number"
            step="0.01"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
          <Input
            placeholder="최대 가격"
            type="number"
            step="0.01"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
          />
          <Input
            placeholder="Stream Key"
            value={filterStreamKey}
            onChange={(e) => setFilterStreamKey(e.target.value)}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-error/10 border border-error rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <Body className="text-error flex-1">{error}</Body>
        </div>
      )}

      {/* Products Table with DnD */}
      <div className="bg-content-bg border border-gray-200 rounded-card overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-secondary-text mx-auto mb-4 opacity-30" />
            <Body className="text-secondary-text mb-4">
              {products.length === 0
                ? '등록된 상품이 없습니다'
                : '필터 조건에 맞는 상품이 없습니다'}
            </Body>
            {products.length === 0 && (
              <Button variant="primary" onClick={() => handleOpenModal()}>
                첫 상품 등록하기
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                <Body className="font-semibold text-primary-text">카드형 상품 목록</Body>
                <span className="text-xs text-secondary-text">
                  모바일에서 터치하기 쉽게 정리했어요
                </span>
              </div>
              {filteredProducts.map((product) => (
                <MobileProductCard
                  key={product.id}
                  product={product}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  formatPrice={formatPrice}
                  getStatusBadge={getStatusBadge}
                  handleOpenModal={handleOpenModal}
                  handleMarkAsSoldOut={handleMarkAsSoldOut}
                  handleDelete={handleDelete}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full">
                  <thead className="bg-white/50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-4 w-8" />
                      <th className="px-2 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.size === filteredProducts.length &&
                            filteredProducts.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="w-5 h-5 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
                        />
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-secondary-text">
                        상품 정보
                      </th>
                      <th className="px-4 py-4 text-right text-sm font-semibold text-secondary-text">
                        가격
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                        재고
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                        등록일
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                        상태
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={filteredProducts.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody className="divide-y divide-gray-200">
                      {filteredProducts.map((product) => (
                        <SortableRow
                          key={product.id}
                          product={product}
                          selectedIds={selectedIds}
                          toggleSelect={toggleSelect}
                          formatPrice={formatPrice}
                          getStatusBadge={getStatusBadge}
                          handleOpenModal={handleOpenModal}
                          handleMarkAsSoldOut={handleMarkAsSoldOut}
                          handleDelete={handleDelete}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 sm:hidden">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-hot-pink/20 bg-content-bg/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Body className="font-semibold text-primary-text">
                  선택한 상품 {selectedIds.size}개
                </Body>
                <p className="mt-1 text-xs text-secondary-text">모바일 일괄 작업</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="shrink-0"
              >
                선택 해제
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('AVAILABLE')}
                className="border-success text-success hover:bg-success/10"
              >
                판매중
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('SOLD_OUT')}
                className="border-warning text-warning hover:bg-warning/10"
              >
                일괄 품절
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="border-error text-error hover:bg-error/10"
              >
                {isBulkDeleting ? '삭제 중' : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
        title="엑셀 상품 업로드"
        maxWidth="xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto px-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Stream Key"
              name="bulk-stream-key"
              value={formData.streamKey}
              onChange={(e) => setFormData((prev) => ({ ...prev, streamKey: e.target.value }))}
              placeholder="예: abc123def456"
              fullWidth
              helperText="이 Stream Key로 업로드된 상품을 묶습니다"
            />
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                업로드할 엑셀
              </label>
              <label className="block cursor-pointer rounded-lg border border-dashed border-gray-300 bg-content-bg px-4 py-3 text-sm text-primary-text hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{importFileName || '엑셀 파일 선택'}</span>
                  <Upload className="w-4 h-4 flex-shrink-0" />
                </div>
              </label>
            </div>
          </div>

          {parsedExcel && (
            <>
              <div className="rounded-xl border border-gray-200 bg-content-bg p-4 text-sm space-y-2">
                <div className="flex flex-wrap gap-4 text-secondary-text">
                  <span>
                    선택 시트:{' '}
                    <strong className="text-primary-text">{parsedExcel.sheetName}</strong>
                  </span>
                  <span>
                    헤더 행:{' '}
                    <strong className="text-primary-text">{parsedExcel.headerRowIndex}</strong>
                  </span>
                  <span>
                    원본 행 수:{' '}
                    <strong className="text-primary-text">{parsedExcel.rows.length}</strong>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        {parsedExcel.headers.map((header) => (
                          <th
                            key={header}
                            className="px-2 py-2 text-left text-secondary-text whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedExcel.rawPreviewRows
                        .slice(parsedExcel.headerRowIndex, parsedExcel.headerRowIndex + 3)
                        .map((row, index) => (
                          <tr
                            key={`${index}-${row.join('|')}`}
                            className="border-t border-gray-100"
                          >
                            {parsedExcel.headers.map((header, headerIndex) => (
                              <td
                                key={`${header}-${headerIndex}`}
                                className="px-2 py-2 whitespace-nowrap text-primary-text"
                              >
                                {row[headerIndex] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['productName', '상품명 컬럼'],
                    ['option', '옵션 컬럼'],
                    ['price', '가격 컬럼'],
                    ['stock', '재고 컬럼'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-secondary-text mb-2">
                      {label}
                    </label>
                    <select
                      value={importMapping[field]}
                      onChange={(e) => handleImportMappingChange(field, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-primary-text"
                    >
                      <option value={UNMAPPED_COLUMN}>선택 안 함</option>
                      {parsedExcel.headers.map((header) => (
                        <option key={`${field}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-hot-pink/20 bg-hot-pink/5 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkImportHideUntilRelease}
                    onChange={(e) => setBulkImportHideUntilRelease(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-hot-pink focus:ring-hot-pink"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-primary-text">
                      대량등록 전용 숨김 처리
                    </span>
                    <span className="block text-xs text-secondary-text mt-1">
                      체크하면 이번 엑셀 업로드 상품만 품절 상태 + 지난상품 비노출로 등록됩니다.
                      이후 판매중으로 변경하면 해당 streamKey 라이브에 실시간 노출됩니다.
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="기본 재고"
                  name="defaultImportStock"
                  type="number"
                  value={defaultImportStock}
                  onChange={(e) => setDefaultImportStock(e.target.value)}
                  placeholder="재고 컬럼이 없을 때 사용"
                  fullWidth
                  helperText="재고 컬럼이 없거나 비었을 때 사용합니다"
                />
                <Input
                  label="기본 가격"
                  name="defaultImportPrice"
                  type="number"
                  value={defaultImportPrice}
                  onChange={(e) => setDefaultImportPrice(e.target.value)}
                  placeholder="가격 컬럼이 없을 때 사용"
                  fullWidth
                  helperText="가격 컬럼이 없는 업체 파일에만 입력하세요"
                />
              </div>

              {importPreview.errors.length > 0 && (
                <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error space-y-1">
                  {importPreview.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}

              {importPreview.warnings.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning space-y-1">
                  {importPreview.warnings.slice(0, 6).map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                  {importPreview.warnings.length > 6 && (
                    <p>외 {importPreview.warnings.length - 6}개 경고</p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-content-bg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-primary-text">정규화 미리보기</h3>
                    <p className="text-xs text-secondary-text">
                      같은 상품명+가격 행은 하나로 묶고 옵션은 합칩니다. 업로드 시 기본 상태는
                      품절입니다.
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-hot-pink">
                    {importPreview.products.length}개 상품 생성 예정
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-secondary-text">
                        <th className="px-2 py-2 text-left">상품명</th>
                        <th className="px-2 py-2 text-left">옵션</th>
                        <th className="px-2 py-2 text-right">가격</th>
                        <th className="px-2 py-2 text-right">재고</th>
                        <th className="px-2 py-2 text-left">원본 행</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.products.slice(0, 20).map((product) => (
                        <tr key={product.key} className="border-b border-gray-50 text-primary-text">
                          <td className="px-2 py-2">{product.name}</td>
                          <td className="px-2 py-2">
                            {product.optionValues.length > 0
                              ? product.optionValues.join(', ')
                              : '-'}
                          </td>
                          <td className="px-2 py-2 text-right">{formatPrice(product.price)}</td>
                          <td className="px-2 py-2 text-right">{product.stock}</td>
                          <td className="px-2 py-2">{product.sourceRows.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.products.length > 20 && (
                  <p className="text-xs text-secondary-text">
                    미리보기는 20개까지만 표시합니다. 실제 업로드는 전체{' '}
                    {importPreview.products.length}개가 진행됩니다.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={handleCloseImportModal}
              disabled={isImporting}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={handleImportProducts}
              disabled={
                !parsedExcel ||
                isImporting ||
                importPreview.errors.length > 0 ||
                importPreview.products.length === 0
              }
            >
              {isImporting ? '업로드 중...' : `품절 상태로 ${importPreview.products.length}개 등록`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? '상품 수정' : '상품 등록'}
        maxWidth="xl"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[calc(100vh-9rem)] overflow-y-auto px-1 pb-24 sm:max-h-[70vh] sm:px-2 sm:pb-28"
        >
          <Input
            label="Stream Key"
            name="streamKey"
            value={formData.streamKey}
            onChange={(e) => setFormData({ ...formData, streamKey: e.target.value })}
            placeholder="예: abc123def456"
            fullWidth
            helperText={
              activeLiveStreamKey && !editingProduct
                ? '현재 라이브 방송의 Stream Key가 자동 입력되었습니다'
                : '라이브 방송에 연결하려면 Stream Key를 입력하세요 (선택사항)'
            }
          />

          <Input
            label="상품명"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="예: 프리미엄 무선 이어폰"
            required
            fullWidth
            error={formErrors.name}
          />

          {/* 상품 기본정보 */}
          <div className="space-y-4 rounded-xl border border-gray-200 p-4">
            <div>
              <Body className="font-semibold text-primary-text">상품 기본정보</Body>
              <p className="mt-1 text-xs text-secondary-text">
                고객에게 보여줄 노출가와 기본 재고를 설정합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="노출가"
                name="originalPrice"
                type="number"
                step="0.01"
                value={formData.originalPrice}
                onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                placeholder="29.00"
                required
                fullWidth
                error={formErrors.originalPrice}
              />
              <Input
                label={formData.variantEnabled ? '총 재고 (옵션 합계)' : '재고'}
                name="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="50"
                required
                fullWidth
                disabled={formData.variantEnabled}
                helperText={
                  formData.variantEnabled
                    ? '옵션 사용 시 옵션별 재고 합계로 자동 계산됩니다.'
                    : undefined
                }
                error={formErrors.stock}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-primary-text">
                판매 상태
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'AVAILABLE' | 'SOLD_OUT' })
                  }
                  className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-hot-pink focus:outline-none"
                >
                  <option value="AVAILABLE">판매중</option>
                  <option value="SOLD_OUT">품절</option>
                </select>
              </label>
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-secondary-text">
                노출가: {currentSellingPrice != null ? formatPrice(currentSellingPrice) : '-'}
                {formData.variantEnabled && variantPreviewRows.length > 0 && (
                  <div className="mt-1 text-xs">
                    조합 수 {variantPreviewRows.length}개 / 옵션별 가격·재고는 아래에서 직접
                    설정합니다
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Body className="font-semibold text-primary-text">옵션 사용</Body>
                <p className="mt-1 text-xs text-secondary-text">
                  색상/사이즈 조합만 지원합니다. 옵션을 켜면 조합 표가 자동 생성됩니다.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-primary-text">
                <input
                  type="checkbox"
                  checked={formData.variantEnabled}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      variantEnabled: e.target.checked,
                      variantPriceMode: 'DIRECT',
                      variants: e.target.checked
                        ? buildColorSizeEditableVariants({
                            colors: parseVariantOptionCsv(prev.colorOptions),
                            sizes: parseVariantOptionCsv(prev.sizeOptions),
                            existingRows: prev.variants,
                            priceMode: 'DIRECT',
                            basePrice: getCurrentSellingPrice(prev),
                          })
                        : [createEmptyEditableVariant()],
                    }))
                  }
                  className="w-4 h-4 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
                />
                옵션 사용
              </label>
            </div>

            {formData.variantEnabled ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="색상 CSV"
                    name="colorOptions"
                    value={formData.colorOptions}
                    onChange={(e) => setFormData({ ...formData, colorOptions: e.target.value })}
                    placeholder="예: Black, Ivory"
                    fullWidth
                    helperText="쉼표(,)로 구분해 입력하세요."
                    error={formErrors.colorOptions}
                  />
                  <Input
                    label="사이즈 CSV"
                    name="sizeOptions"
                    value={formData.sizeOptions}
                    onChange={(e) => setFormData({ ...formData, sizeOptions: e.target.value })}
                    placeholder="예: M, L"
                    fullWidth
                    helperText="한쪽만 입력하면 단일 축 옵션으로 생성됩니다."
                    error={formErrors.sizeOptions}
                  />
                </div>

                <div className="space-y-2">
                  <Body className="font-semibold text-primary-text">조합 미리보기</Body>
                  {variantPreviewRows.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {variantPreviewRows.map((variant) => (
                        <span
                          key={`${variant.color}-${variant.size}-${variant.label}`}
                          className="rounded-full bg-hot-pink/10 px-3 py-1 text-xs font-medium text-hot-pink"
                        >
                          {variant.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-secondary-text">
                      색상 또는 사이즈를 입력하면 조합이 자동 생성됩니다.
                    </p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-gray-100 bg-white/60 p-4">
                  <div>
                    <Body className="font-semibold text-primary-text">옵션별 가격 / 재고 설정</Body>
                    <p className="mt-1 text-xs text-secondary-text">
                      노출가는 위에서 관리하고, 실제 판매 가격과 재고는 각 옵션 조합별로 직접
                      입력합니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-dashed border-hot-pink/30 bg-hot-pink/5 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <Body className="font-semibold text-primary-text">
                          동일 재고/가격 빠른 적용
                        </Body>
                        <p className="mt-1 text-xs text-secondary-text">
                          모바일에서 옵션별 가격/재고를 빠르게 입력하려면 아래 값을 한 번에
                          적용하세요.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px] lg:flex-1">
                        <Input
                          label={'전체 가격'}
                          type="number"
                          step="0.01"
                          value={variantBulkPrice}
                          onChange={(e) => setVariantBulkPrice(e.target.value)}
                          placeholder="29.00"
                          fullWidth
                        />
                        <Input
                          label="전체 재고"
                          type="number"
                          value={variantBulkStock}
                          onChange={(e) => setVariantBulkStock(e.target.value)}
                          placeholder="0"
                          fullWidth
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setVariantBulkPrice('');
                          setVariantBulkStock('');
                        }}
                        className="sm:w-auto"
                      >
                        입력값 지우기
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleApplyVariantBulkValues}
                        disabled={!variantBulkPrice.trim() && !variantBulkStock.trim()}
                        className="sm:w-auto"
                      >
                        입력값 전체 적용
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 lg:hidden">
                    {formData.variants.map((variant, index) => (
                      <div
                        key={`${variant.id ?? 'new-mobile'}-${variant.color}-${variant.size}-${index}`}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-primary-text">
                              {variant.label ||
                                [variant.color, variant.size].filter(Boolean).join(' / ') ||
                                '기본 옵션'}
                            </p>
                            <p className="mt-1 text-xs text-secondary-text">
                              색상 {variant.color || '-'} / 사이즈 {variant.size || '-'}
                            </p>
                          </div>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-secondary-text">
                            옵션 {index + 1}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Input
                            label="조합명"
                            value={variant.label ?? ''}
                            onChange={(e) =>
                              handleVariantFieldChange(index, 'label', e.target.value)
                            }
                            placeholder={`${variant.color || ''}${variant.color && variant.size ? ' / ' : ''}${variant.size || ''}`}
                            fullWidth
                          />
                          <Input
                            label="옵션별 가격"
                            type="number"
                            step="0.01"
                            value={variant.price}
                            onChange={(e) =>
                              handleVariantFieldChange(index, 'price', e.target.value)
                            }
                            placeholder="29.00"
                            fullWidth
                          />
                          <Input
                            label="옵션별 재고"
                            type="number"
                            value={variant.stock}
                            onChange={(e) =>
                              handleVariantFieldChange(index, 'stock', e.target.value)
                            }
                            placeholder="0"
                            fullWidth
                          />
                          <label className="flex flex-col gap-1 text-sm font-medium text-primary-text">
                            상태
                            <select
                              value={variant.status}
                              onChange={(e) =>
                                handleVariantFieldChange(index, 'status', e.target.value)
                              }
                              className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-hot-pink focus:outline-none"
                            >
                              <option value="ACTIVE">판매중</option>
                              <option value="SOLD_OUT">품절</option>
                              <option value="HIDDEN">숨김</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead>
                        <tr className="text-left text-secondary-text">
                          <th className="py-2 pr-3">색상</th>
                          <th className="py-2 pr-3">사이즈</th>
                          <th className="py-2 pr-3">조합명</th>
                          <th className="py-2 pr-3">옵션별 가격</th>
                          <th className="py-2 pr-3">옵션별 재고</th>
                          <th className="py-2 pr-3">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.variants.map((variant, index) => (
                          <tr
                            key={`${variant.id ?? 'new'}-${variant.color}-${variant.size}-${index}`}
                          >
                            <td className="py-3 pr-3 text-primary-text">{variant.color || '-'}</td>
                            <td className="py-3 pr-3 text-primary-text">{variant.size || '-'}</td>
                            <td className="py-3 pr-3 min-w-[200px]">
                              <Input
                                value={variant.label ?? ''}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'label', e.target.value)
                                }
                                placeholder={`${variant.color || ''}${variant.color && variant.size ? ' / ' : ''}${variant.size || ''}`}
                                fullWidth
                              />
                            </td>
                            <td className="py-3 pr-3 min-w-[140px]">
                              <Input
                                type="number"
                                step="0.01"
                                value={variant.price}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'price', e.target.value)
                                }
                                placeholder="29.00"
                                fullWidth
                              />
                            </td>
                            <td className="py-3 pr-3 min-w-[120px]">
                              <Input
                                type="number"
                                value={variant.stock}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'stock', e.target.value)
                                }
                                placeholder="0"
                                fullWidth
                              />
                            </td>
                            <td className="py-3 pr-3 min-w-[140px]">
                              <select
                                value={variant.status}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'status', e.target.value)
                                }
                                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-hot-pink focus:outline-none"
                              >
                                <option value="ACTIVE">판매중</option>
                                <option value="SOLD_OUT">품절</option>
                                <option value="HIDDEN">숨김</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-secondary-text">
                옵션을 끄면 노출가와 단일 재고/판매 상태만 저장됩니다.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.timerEnabled}
                onChange={(e) => setFormData({ ...formData, timerEnabled: e.target.checked })}
                className="w-4 h-4 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
              />
              <span className="text-sm font-medium text-primary-text">
                장바구니 예약 타이머 활성화
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isNew}
                onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                className="w-4 h-4 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
              />
              <span className="text-sm font-medium text-primary-text">NEW 뱃지 표시</span>
            </label>
            {formData.timerEnabled && (
              <Input
                label="타이머 시간 (시간)"
                name="timerDurationHours"
                type="number"
                value={formData.timerDurationHours}
                onChange={(e) => setFormData({ ...formData, timerDurationHours: e.target.value })}
                placeholder="1"
                min={`${MIN_TIMER_HOURS}`}
                max={`${MAX_TIMER_HOURS}`}
              />
            )}
          </div>

          {/* Expiry Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              만료까지 시간 <span className="text-gray-500">(선택, 시간 단위)</span>
            </label>
            <input
              type="number"
              min="1"
              max="8760"
              placeholder="예: 24 (24시간 후 자동 삭제)"
              value={formData.expiresAtHours ?? ''}
              onChange={(e) =>
                setFormData({ ...formData, expiresAtHours: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-hot-pink/30 focus:border-hot-pink"
            />
            <p className="text-xs text-gray-500 mt-1">
              입력한 시간 후 자동으로 삭제됩니다 (예: 24 = 24시간 후)
            </p>
          </div>

          {/* Main Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              대표 이미지
            </label>

            {(previewUrl || formData.imageUrl) && (
              <div className="relative mb-4">
                <img
                  src={previewUrl || formData.imageUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center bg-error text-white rounded-full hover:bg-error/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-content-bg border border-gray-200 rounded-lg text-primary-text hover:bg-gray-50 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : '대표 이미지 선택'}
                  </span>
                </div>
              </label>

              {selectedFile && !formData.imageUrl && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="whitespace-nowrap"
                >
                  {isUploading ? '업로드 중...' : '업로드'}
                </Button>
              )}
            </div>
          </div>

          {/* Gallery Images Section */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              추가 이미지 (갤러리)
            </label>

            {formData.images.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {formData.images.map((url, idx) => (
                  <div key={url} className="relative group">
                    <img
                      src={url}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-20 object-contain rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveGalleryImage(idx)}
                      className="absolute top-1 right-1 inline-flex h-8 w-8 min-h-[44px] min-w-[44px] items-center justify-center bg-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryFileSelect}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-content-bg border border-gray-200 rounded-lg text-primary-text hover:bg-gray-50 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {galleryFiles.length > 0
                      ? `${galleryFiles.length}개 파일 선택됨`
                      : '추가 이미지 선택 (여러 파일)'}
                  </span>
                </div>
              </label>

              {galleryFiles.length > 0 && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleGalleryUpload}
                  disabled={isUploadingGallery}
                  className="whitespace-nowrap"
                >
                  {isUploadingGallery ? '업로드 중...' : '업로드'}
                </Button>
              )}
            </div>

            <p className="text-xs text-secondary-text mt-2">
              JPG, PNG, GIF, WEBP 형식 지원 (최대 5MB, 여러 파일 선택 가능)
            </p>
          </div>

          <div className="sticky bottom-0 -mx-1 border-t border-gray-200 bg-content-bg/95 px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-4 backdrop-blur sm:-mx-2 sm:px-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={isSubmitting || isUploadingGallery}
              >
                {isSubmitting ? '저장 중...' : editingProduct ? '수정하기' : '등록하기'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
