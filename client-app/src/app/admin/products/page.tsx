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
  buildColorSizeEditableVariants,
  convertVariantRowsPriceMode,
  createEmptyEditableVariant,
  deriveOptionSummaries,
  inferVariantPriceMode,
  parseVariantOptionCsv,
  serializeVariantsForSubmit,
  validateColorSizeVariants,
  type EditableProductVariant,
  type VariantPriceMode,
} from '@/lib/utils/product-variants';
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

function calcDiscountRate(originalPrice: string, discountPrice: string): number | null {
  const orig = parseFloat(originalPrice);
  const disc = parseFloat(discountPrice);
  if (isNaN(orig) || isNaN(disc) || orig <= 0 || disc <= 0 || disc >= orig) return null;
  return Math.round(((orig - disc) / orig) * 1000) / 10;
}

function getCurrentSellingPrice(
  formData: Pick<ProductFormData, 'discountEnabled' | 'discountPrice' | 'originalPrice'>,
) {
  const sourcePrice =
    formData.discountEnabled && formData.discountPrice
      ? formData.discountPrice
      : formData.originalPrice;
  const parsed = Number.parseFloat(sourcePrice);
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
      variantPriceMode: 'ADD_ON',
      variants: [createEmptyEditableVariant()],
    };
  }

  const variantPriceMode = inferVariantPriceMode(product.variants as any);
  const basePrice = product.price;

  return {
    variantEnabled: true,
    variantPriceMode,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      color: variant.color ?? '',
      size: variant.size ?? '',
      label: variant.label ?? '',
      price:
        variantPriceMode === 'ADD_ON' ? String(variant.price - basePrice) : String(variant.price),
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

  // --- Modal Close ---
  const handleCloseModal = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSelectedFile(null);
    setGalleryFiles([]);
    setEditingProduct(null);
    setFormErrors({});
    setIsModalOpen(false);
  };

  // --- Modal Open ---
  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      const hasDiscount = product.originalPrice != null && product.originalPrice > product.price;
      const variantEditorState = mapProductToVariantEditorState(product);
      setFormData({
        streamKey: product.streamKey || '',
        name: product.name,
        // originalPrice = 정가 (할인 있으면 originalPrice, 없으면 price)
        originalPrice: hasDiscount ? product.originalPrice!.toString() : product.price.toString(),
        discountEnabled: hasDiscount,
        discountPrice: hasDiscount ? product.price.toString() : '',
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

  // Compute live discount rate for form preview
  const liveDiscountRate = formData.discountEnabled
    ? calcDiscountRate(formData.originalPrice, formData.discountPrice)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Body className="text-secondary-text">상품 목록을 불러오는 중...</Body>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary-text mb-2">상품 관리</h1>
          <p className="text-secondary-text">라이브에서 판매할 상품을 등록하고 관리하세요</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            variant="primary"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            상품 등록
          </Button>
        </div>
      </div>

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
          <div className="overflow-x-auto">
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
        )}
      </div>

      {/* Product Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? '상품 수정' : '상품 등록'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
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
                옵션 사용 여부와 관계없이 대표 판매 정보로 사용됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="판매 가격"
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
                    ? '옵션 사용 시 활성 옵션 재고 합계로 자동 계산됩니다.'
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
                대표 판매가: {currentSellingPrice != null ? formatPrice(currentSellingPrice) : '-'}
                {formData.variantEnabled && variantPreviewRows.length > 0 && (
                  <div className="mt-1 text-xs">
                    조합 수 {variantPreviewRows.length}개 / 옵션 가격 모드{' '}
                    {formData.variantPriceMode === 'ADD_ON'
                      ? '기본 가격 + 추가금'
                      : '옵션별 개별 가격'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 할인 토글 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.discountEnabled}
                onChange={(e) =>
                  setFormData({ ...formData, discountEnabled: e.target.checked, discountPrice: '' })
                }
                className="w-4 h-4 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
              />
              <span className="text-sm font-medium text-primary-text">할인 적용</span>
            </label>
          </div>

          {/* 할인 가격 입력 (할인 활성 시만 표시) */}
          {formData.discountEnabled && (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    label="할인 가격"
                    name="discountPrice"
                    type="number"
                    step="0.01"
                    value={formData.discountPrice}
                    onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
                    placeholder="24.00"
                    required
                    fullWidth
                    error={formErrors.discountPrice}
                  />
                </div>
                {liveDiscountRate !== null && (
                  <div className="mt-5">
                    <span className="inline-block px-2.5 py-1.5 rounded-lg bg-error/15 text-error text-sm font-bold whitespace-nowrap">
                      할인율: {liveDiscountRate}%
                    </span>
                  </div>
                )}
              </div>
              {formData.discountPrice &&
                formData.originalPrice &&
                parseFloat(formData.discountPrice) >= parseFloat(formData.originalPrice) && (
                  <p className="text-xs text-error mt-1">할인 가격은 정가보다 작아야 합니다</p>
                )}
            </div>
          )}

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
                      variants: e.target.checked
                        ? buildColorSizeEditableVariants({
                            colors: parseVariantOptionCsv(prev.colorOptions),
                            sizes: parseVariantOptionCsv(prev.sizeOptions),
                            existingRows: prev.variants,
                            priceMode: prev.variantPriceMode,
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
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Body className="font-semibold text-primary-text">옵션 가격 설정</Body>
                      <p className="mt-1 text-xs text-secondary-text">
                        {formData.variantPriceMode === 'ADD_ON'
                          ? '기본 판매 가격을 기준으로 옵션별 추가금을 입력합니다.'
                          : '각 옵션 조합의 최종 판매 가격을 직접 입력합니다.'}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-gray-200 p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            variantPriceMode: 'ADD_ON',
                            variants: convertVariantRowsPriceMode(prev.variants, {
                              from: prev.variantPriceMode,
                              to: 'ADD_ON',
                              basePrice: getCurrentSellingPrice(prev),
                            }),
                          }))
                        }
                        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          formData.variantPriceMode === 'ADD_ON'
                            ? 'bg-hot-pink text-white'
                            : 'text-secondary-text hover:bg-gray-50'
                        }`}
                      >
                        기본 가격 + 추가금
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            variantPriceMode: 'DIRECT',
                            variants: convertVariantRowsPriceMode(prev.variants, {
                              from: prev.variantPriceMode,
                              to: 'DIRECT',
                              basePrice: getCurrentSellingPrice(prev),
                            }),
                          }))
                        }
                        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          formData.variantPriceMode === 'DIRECT'
                            ? 'bg-hot-pink text-white'
                            : 'text-secondary-text hover:bg-gray-50'
                        }`}
                      >
                        옵션별 개별 가격
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead>
                        <tr className="text-left text-secondary-text">
                          <th className="py-2 pr-3">색상</th>
                          <th className="py-2 pr-3">사이즈</th>
                          <th className="py-2 pr-3">조합명</th>
                          <th className="py-2 pr-3">
                            {formData.variantPriceMode === 'ADD_ON' ? '추가금' : '개별 가격'}
                          </th>
                          <th className="py-2 pr-3">재고</th>
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
                                placeholder={formData.variantPriceMode === 'ADD_ON' ? '0' : '29.00'}
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
                옵션을 끄면 일반 단일 상품처럼 대표 가격/재고/판매 상태만 저장됩니다.
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
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

            <div className="flex gap-2">
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
              <div className="grid grid-cols-4 gap-2 mb-4">
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

            <div className="flex gap-2">
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

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4">
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
        </form>
      </Modal>
    </div>
  );
}
