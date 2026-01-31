'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { apiClient } from '@/lib/api/client';
import { Plus, Edit, Trash2, Package, AlertCircle, Upload, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SOLD_OUT';
  imageUrl?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  imageUrl: string;
  streamKey: string;
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    stock: '',
    imageUrl: '',
    streamKey: 'default-stream',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<Product[]>('/products');
      setProducts(response.data);
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
      // Create preview URL
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
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        imageUrl: product.imageUrl || '',
        streamKey: 'default-stream',
      });
      setPreviewUrl(product.imageUrl || '');
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        stock: '',
        imageUrl: '',
        streamKey: 'default-stream',
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
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
      };

      if (editingProduct) {
        // Update
        await apiClient.patch(`/products/${editingProduct.id}`, payload);
      } else {
        // Create
        await apiClient.post('/products', payload);
      }

      fetchProducts();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save product:', err);
      alert('상품 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await apiClient.delete(`/products/${productId}`);
      fetchProducts();
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      alert('상품 삭제에 실패했습니다.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { text: '활성', color: 'bg-success/20 text-success' };
      case 'INACTIVE':
        return { text: '비활성', color: 'bg-secondary-text/20 text-secondary-text' };
      case 'SOLD_OUT':
        return { text: '품절', color: 'bg-error/20 text-error' };
      default:
        return { text: status, color: 'bg-gray-100 text-secondary-text' };
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
                            {product.description && (
                              <Body className="text-secondary-text text-xs line-clamp-1">
                                {product.description}
                              </Body>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Body className="text-primary-text font-bold">
                          {formatPrice(product.price)}
                        </Body>
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
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusBadge.color}`}
                        >
                          {statusBadge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(product)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-hot-pink"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-error"
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
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="상품명"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="예: 프리미엄 무선 이어폰"
            required
            fullWidth
          />

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              상품 설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="상품에 대한 상세 설명을 입력하세요"
              rows={4}
              className="w-full bg-content-bg border border-gray-200 rounded-lg px-4 py-3 text-primary-text placeholder:text-secondary-text focus:outline-none focus:border-hot-pink transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="가격"
              name="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="89000"
              required
              fullWidth
            />
            <Input
              label="재고"
              name="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              placeholder="100"
              required
              fullWidth
            />
          </div>

          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              상품 이미지
            </label>

            {/* Image Preview */}
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

            {/* File Input */}
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
