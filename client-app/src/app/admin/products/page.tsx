'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { apiClient } from '@/lib/api/client';
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
  Copy,
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
}

interface ProductFormData {
  streamKey: string;
  name: string;
  price: string;
  stock: string;
  colorOptions: string;
  sizeOptions: string;
  timerEnabled: boolean;
  timerDurationHours: string;
  imageUrl: string;
  images: string[];
  discountRate: string;
  originalPrice: string;
  isNew: boolean;
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

// --- Sortable Row Component ---
function SortableRow({
  product,
  selectedIds,
  toggleSelect,
  formatPrice,
  getStatusBadge,
  handleOpenModal,
  handleMarkAsSoldOut,
  handleDuplicate,
  handleDelete,
}: {
  product: Product;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => { text: string; color: string };
  handleOpenModal: (product?: Product) => void;
  handleMarkAsSoldOut: (id: string) => void;
  handleDuplicate: (id: string) => void;
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
          className="cursor-grab active:cursor-grabbing p-1 text-secondary-text hover:text-primary-text"
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
          className="w-4 h-4 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
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
              {product.colorOptions.length > 0 && (
                <span className="text-xs bg-info/20 text-info px-2 py-0.5 rounded">
                  {product.colorOptions.length} 색상
                </span>
              )}
              {product.sizeOptions.length > 0 && (
                <span className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded">
                  {product.sizeOptions.length} 사이즈
                </span>
              )}
              {product.timerEnabled && (
                <span className="text-xs bg-hot-pink/20 text-hot-pink px-2 py-0.5 rounded">
                  <Timer className="w-4 h-4 inline-block mr-1" aria-hidden="true" />{' '}
                  {minutesToHours(product.timerDuration)}시간
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{product.streamKey}</code>
      </td>
      <td className="px-4 py-4 text-right">
        <Body className="text-primary-text font-bold">{formatPrice(product.price)}</Body>
        {product.shippingFee > 0 && (
          <Body className="text-xs text-secondary-text">
            +배송비 {formatPrice(product.shippingFee)}
          </Body>
        )}
      </td>
      <td className="px-4 py-4 text-center">
        <Body className={`font-semibold ${product.stock < 5 ? 'text-error' : 'text-primary-text'}`}>
          {product.stock}개
        </Body>
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-hot-pink"
            title="수정"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDuplicate(product.id)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-info"
            title="복제"
          >
            <Copy className="w-4 h-4" />
          </button>
          {product.status === 'AVAILABLE' && (
            <button
              onClick={() => handleMarkAsSoldOut(product.id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-warning"
              title="품절 처리"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDelete(product.id)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-error"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// --- Main Page Component ---
export default function AdminProductsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const confirmAction = useConfirm();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStreamKey, setFilterStreamKey] = useState<string>('');

  // Search & Filter state (Feature 5)
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Gallery images state (Feature 3)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    streamKey: '',
    name: '',
    price: '',
    stock: '',
    colorOptions: '',
    sizeOptions: '',
    timerEnabled: false,
    timerDurationHours: '1',
    imageUrl: '',
    images: [],
    discountRate: '',
    originalPrice: '',
    isNew: false,
  });

  // DnD sensors (Feature 2)
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

  // Client-side filtered products (Feature 5)
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
      if (filterStreamKey) {
        params.set('streamKey', filterStreamKey);
      }
      const url = `/products${params.toString() ? `?${params}` : ''}`;
      const response = await apiClient.get(url);
      setProducts((response.data as Product[]) || []);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  // --- Feature 1: Duplicate ---
  const handleDuplicate = async (productId: string) => {
    try {
      await apiClient.post(`/products/${productId}/duplicate`, {});
      fetchProducts();
      showToast('상품이 복제되었습니다!', 'success');
    } catch (err: any) {
      console.error('Failed to duplicate product:', err);
      showToast(`상품 복제에 실패했습니다: ${err.message}`, 'error');
    }
  };

  // --- Feature 2: DnD Reorder ---
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

  // --- Feature 4: Bulk Status Change ---
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
      showToast(`${selectedIds.size}개 상품이 "${label}"으로 변경되었습니다.`, 'success');
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      console.error('Bulk status change failed:', err);
      showToast(`상태 변경에 실패했습니다: ${err.message}`, 'error');
    }
  };

  // --- Image Upload ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
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

  // --- Feature 3: Gallery Image Upload ---
  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setGalleryFiles(files);
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

  // --- Modal Close ---
  const handleCloseModal = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSelectedFile(null);
    setGalleryFiles([]);
    setEditingProduct(null);
    setIsModalOpen(false);
  };

  // --- Modal Open ---
  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        streamKey: product.streamKey,
        name: product.name,
        price: product.price.toString(),
        stock: product.stock.toString(),
        colorOptions: product.colorOptions.join(', '),
        sizeOptions: product.sizeOptions.join(', '),
        timerEnabled: product.timerEnabled,
        timerDurationHours: minutesToHours(product.timerDuration).toString(),
        imageUrl: product.imageUrl || '',
        images: product.images || [],
        discountRate: product.discountRate?.toString() || '',
        originalPrice: product.originalPrice?.toString() || '',
        isNew: product.isNew || false,
      });
      setPreviewUrl(product.imageUrl || '');
    } else {
      setEditingProduct(null);
      setFormData({
        streamKey: activeLiveStreamKey,
        name: '',
        price: '',
        stock: '',
        colorOptions: '',
        sizeOptions: '',
        timerEnabled: false,
        timerDurationHours: '1',
        imageUrl: '',
        images: [],
        discountRate: '',
        originalPrice: '',
        isNew: false,
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

      const basePayload = {
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        colorOptions: formData.colorOptions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        sizeOptions: formData.sizeOptions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
        images: formData.images,
        discountRate: formData.discountRate ? parseFloat(formData.discountRate) : undefined,
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
        isNew: formData.isNew,
      };

      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, basePayload);
      } else {
        await apiClient.post('/products', {
          streamKey: formData.streamKey.trim() || undefined,
          ...basePayload,
        });
      }

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
      <div className="flex items-center justify-center min-h-screen">
        <Body className="text-secondary-text">상품 목록을 불러오는 중...</Body>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary-text mb-2">상품 관리</h1>
          <p className="text-secondary-text">라이브에서 판매할 상품을 등록하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleBulkStatusChange('AVAILABLE')}
                className="flex items-center gap-2 border-success text-success hover:bg-success/10"
              >
                판매중으로 변경
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkStatusChange('SOLD_OUT')}
                className="flex items-center gap-2 border-warning text-warning hover:bg-warning/10"
              >
                품절로 변경
              </Button>
              <Button
                variant="outline"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
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

      {/* Search & Filter (Feature 5) */}
      <div className="bg-content-bg border border-gray-200 rounded-card p-4 space-y-3">
        <div className="flex gap-4">
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
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hot-pink/30 focus:border-hot-pink"
          >
            <option value="">전체 상태</option>
            <option value="AVAILABLE">판매중</option>
            <option value="SOLD_OUT">품절</option>
          </select>
          <Input
            placeholder="최소 가격"
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
          <Input
            placeholder="최대 가격"
            type="number"
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

      {/* Products Table with DnD (Feature 2) */}
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
                        className="w-4 h-4 text-hot-pink border-gray-300 rounded focus:ring-hot-pink"
                      />
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-secondary-text">
                      상품명
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                      Stream Key
                    </th>
                    <th className="px-4 py-4 text-right text-sm font-semibold text-secondary-text">
                      가격
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                      재고
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                      상태
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-secondary-text">
                      관리
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
                        handleDuplicate={handleDuplicate}
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
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="가격 ($)"
              name="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="29000"
              required
              fullWidth
            />
            <Input
              label="재고"
              name="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              placeholder="50"
              required
              fullWidth
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="할인율 (%)"
              name="discountRate"
              type="number"
              value={formData.discountRate}
              onChange={(e) => setFormData({ ...formData, discountRate: e.target.value })}
              placeholder="예: 15 (15% 할인)"
              min="0"
              max="100"
              fullWidth
            />
            <Input
              label="정가 (할인 전 가격 $)"
              name="originalPrice"
              type="number"
              value={formData.originalPrice}
              onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
              placeholder="예: 35"
              fullWidth
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="색상 옵션 (쉼표로 구분)"
              name="colorOptions"
              value={formData.colorOptions}
              onChange={(e) => setFormData({ ...formData, colorOptions: e.target.value })}
              placeholder="예: Red, Blue, Black"
              fullWidth
            />
            <Input
              label="사이즈 옵션 (쉼표로 구분)"
              name="sizeOptions"
              value={formData.sizeOptions}
              onChange={(e) => setFormData({ ...formData, sizeOptions: e.target.value })}
              placeholder="예: S, M, L, XL"
              fullWidth
            />
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
                  className="absolute top-2 right-2 p-2 bg-error text-white rounded-full hover:bg-error/90 transition-colors"
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

          {/* Gallery Images Section (Feature 3) */}
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
                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveGalleryImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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

          <div className="flex gap-4 pt-4">
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
