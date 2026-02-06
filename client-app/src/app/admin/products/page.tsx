'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { apiClient } from '@/lib/api/client';
import { Plus, Edit, Trash2, Package, AlertCircle, Upload, X, CheckCircle } from 'lucide-react';

interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration: number;
  imageUrl?: string;
  status: 'AVAILABLE' | 'SOLD_OUT';
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  streamKey: string;
  name: string;
  price: string;
  stock: string;
  colorOptions: string;
  sizeOptions: string;
  shippingFee: string;
  freeShippingMessage: string;
  timerEnabled: boolean;
  timerDuration: string;
  imageUrl: string;
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStreamKey, setFilterStreamKey] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    streamKey: '',
    name: '',
    price: '',
    stock: '',
    colorOptions: '',
    sizeOptions: '',
    shippingFee: '3000',
    freeShippingMessage: '',
    timerEnabled: false,
    timerDuration: '10',
    imageUrl: '',
  });

  useEffect(() => {
    fetchProducts();
  }, [filterStreamKey]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      // Use mock data for demo
      const mockProducts: Product[] = [
        {
          id: 'prod-001',
          streamKey: 'live-001',
          name: 'Chic Evening Bag',
          price: 129000,
          stock: 10,
          colorOptions: ['Black', 'Brown', 'Beige'],
          sizeOptions: [],
          shippingFee: 3000,
          freeShippingMessage: '50,000원 이상 무료배송',
          timerEnabled: false,
          timerDuration: 10,
          imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80',
          status: 'AVAILABLE',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'prod-002',
          streamKey: 'live-001',
          name: 'Pro Audio Pods',
          price: 89000,
          stock: 25,
          colorOptions: ['White', 'Black'],
          sizeOptions: [],
          shippingFee: 0,
          freeShippingMessage: '무료배송',
          timerEnabled: true,
          timerDuration: 15,
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
          status: 'AVAILABLE',
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'prod-003',
          streamKey: 'live-002',
          name: 'Handmade Tableware',
          price: 45000,
          stock: 15,
          colorOptions: ['White', 'Gray', 'Blue'],
          sizeOptions: [],
          shippingFee: 3000,
          timerEnabled: false,
          timerDuration: 10,
          imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=500&q=80',
          status: 'AVAILABLE',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'prod-004',
          streamKey: 'live-002',
          name: 'Smart Fitness Watch',
          price: 199000,
          stock: 0,
          colorOptions: ['Black', 'Silver', 'Gold'],
          sizeOptions: ['S', 'M', 'L'],
          shippingFee: 0,
          freeShippingMessage: '무료배송',
          timerEnabled: true,
          timerDuration: 20,
          imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
          status: 'SOLD_OUT',
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'prod-005',
          streamKey: 'live-003',
          name: 'Premium Leather Wallet',
          price: 79000,
          stock: 20,
          colorOptions: ['Brown', 'Black', 'Navy'],
          sizeOptions: [],
          shippingFee: 3000,
          freeShippingMessage: '50,000원 이상 무료배송',
          timerEnabled: false,
          timerDuration: 10,
          imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80',
          status: 'AVAILABLE',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'prod-006',
          streamKey: 'live-003',
          name: 'Wireless Keyboard',
          price: 149000,
          stock: 12,
          colorOptions: ['White', 'Black'],
          sizeOptions: [],
          shippingFee: 0,
          freeShippingMessage: '무료배송',
          timerEnabled: true,
          timerDuration: 12,
          imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80',
          status: 'AVAILABLE',
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      setProducts(mockProducts);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formDataToUpload = new FormData();
      formDataToUpload.append('file', selectedFile);

      const response = await fetch('http://localhost:3001/api/upload/image', {
        method: 'POST',
        body: formDataToUpload,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      const imageUrl = `http://localhost:3001${result.data.url}`;

      setFormData({ ...formData, imageUrl });
      alert('이미지가 업로드되었습니다!');
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setFormData({ ...formData, imageUrl: '' });
  };

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
        shippingFee: product.shippingFee.toString(),
        freeShippingMessage: product.freeShippingMessage || '',
        timerEnabled: product.timerEnabled,
        timerDuration: product.timerDuration.toString(),
        imageUrl: product.imageUrl || '',
      });
      setPreviewUrl(product.imageUrl || '');
    } else {
      setEditingProduct(null);
      setFormData({
        streamKey: '',
        name: '',
        price: '',
        stock: '',
        colorOptions: '',
        sizeOptions: '',
        shippingFee: '3000',
        freeShippingMessage: '',
        timerEnabled: false,
        timerDuration: '10',
        imageUrl: '',
      });
      setPreviewUrl('');
    }
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        streamKey: formData.streamKey,
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        colorOptions: formData.colorOptions.split(',').map(s => s.trim()).filter(Boolean),
        sizeOptions: formData.sizeOptions.split(',').map(s => s.trim()).filter(Boolean),
        shippingFee: parseFloat(formData.shippingFee),
        freeShippingMessage: formData.freeShippingMessage || undefined,
        timerEnabled: formData.timerEnabled,
        timerDuration: parseInt(formData.timerDuration),
        imageUrl: formData.imageUrl || undefined,
      };

      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, payload);
      } else {
        await apiClient.post('/products', payload);
      }

      fetchProducts();
      setIsModalOpen(false);
      alert(editingProduct ? '상품이 수정되었습니다!' : '상품이 등록되었습니다!');
    } catch (err: any) {
      console.error('Failed to save product:', err);
      alert(`상품 저장에 실패했습니다: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsSoldOut = async (productId: string) => {
    if (!confirm('이 상품을 품절 처리하시겠습니까?')) return;

    try {
      await apiClient.patch(`/products/${productId}/sold-out`, {});
      fetchProducts();
      alert('상품이 품절 처리되었습니다.');
    } catch (err: any) {
      console.error('Failed to mark as sold out:', err);
      alert('품절 처리에 실패했습니다.');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      await apiClient.delete(`/products/${productId}`);
      fetchProducts();
      alert('상품이 삭제되었습니다.');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      alert(`상품 삭제에 실패했습니다: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return { text: '판매중', color: 'bg-green-500/20 text-green-500' };
      case 'SOLD_OUT':
        return { text: '품절', color: 'bg-red-500/20 text-red-500' };
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
          <h1 className="text-3xl font-bold text-primary-text mb-2">
            상품 관리 <span className="text-hot-pink">📦</span>
          </h1>
          <p className="text-secondary-text">라이브에서 판매할 상품을 등록하고 관리하세요</p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          상품 등록
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Input
          label="Stream Key로 필터"
          value={filterStreamKey}
          onChange={(e) => setFilterStreamKey(e.target.value)}
          placeholder="stream key 입력 (비우면 전체 조회)"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-error/10 border border-error rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <Body className="text-error flex-1">{error}</Body>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-content-bg border border-gray-200 rounded-card overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-secondary-text mx-auto mb-4 opacity-30" />
            <Body className="text-secondary-text mb-4">등록된 상품이 없습니다</Body>
            <Button variant="primary" onClick={() => handleOpenModal()}>
              첫 상품 등록하기
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-secondary-text">
                    상품명
                  </th>
                   <th className="px-6 py-4 text-center text-sm font-semibold text-secondary-text">
                    스트림 키
                   </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-secondary-text">
                    가격
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-secondary-text">
                    재고
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-secondary-text">
                    상태
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-secondary-text">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => {
                  const statusBadge = getStatusBadge(product.status);
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
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
                            <Body className="text-primary-text font-semibold">
                              {product.name}
                            </Body>
                            <div className="flex gap-2 mt-1">
                              {product.colorOptions.length > 0 && (
                                <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
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
                                  ⏱️ {product.timerDuration}분
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {product.streamKey}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Body className="text-primary-text font-bold">
                          {formatPrice(product.price)}
                        </Body>
                        {product.shippingFee > 0 && (
                          <Body className="text-xs text-secondary-text">
                            +배송비 {formatPrice(product.shippingFee)}
                          </Body>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Body
                          className={`font-semibold ${product.stock < 5 ? 'text-error' : 'text-primary-text'}`}
                        >
                          {product.stock}개
                        </Body>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${statusBadge.color}`}
                        >
                          {statusBadge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(product)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-hot-pink"
                            title="수정"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {product.status === 'AVAILABLE' && (
                            <button
                              onClick={() => handleMarkAsSoldOut(product.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-orange-500"
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
            required
            fullWidth
            helperText="라이브 방송의 Stream Key를 입력하세요"
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
              label="가격 (원)"
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="배송비 (원)"
              name="shippingFee"
              type="number"
              value={formData.shippingFee}
              onChange={(e) => setFormData({ ...formData, shippingFee: e.target.value })}
              placeholder="3000"
              fullWidth
            />
            <Input
              label="무료 배송 안내 문구"
              name="freeShippingMessage"
              value={formData.freeShippingMessage}
              onChange={(e) => setFormData({ ...formData, freeShippingMessage: e.target.value })}
              placeholder="예: 5만원 이상 무료배송"
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
              <span className="text-sm font-medium text-primary-text">장바구니 예약 타이머 활성화</span>
            </label>
            {formData.timerEnabled && (
              <Input
                label="타이머 시간 (분)"
                name="timerDuration"
                type="number"
                value={formData.timerDuration}
                onChange={(e) => setFormData({ ...formData, timerDuration: e.target.value })}
                placeholder="10"
                min="1"
                max="60"
              />
            )}
          </div>

          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              상품 이미지
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
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-content-bg border border-gray-200 rounded-lg text-primary-text hover:bg-gray-50 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : '이미지 선택'}
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

            <p className="text-xs text-secondary-text mt-2">
              JPG, PNG, GIF, WEBP 형식 지원 (최대 5MB)
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? '저장 중...' : editingProduct ? '수정하기' : '등록하기'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
