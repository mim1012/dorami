'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { useStreamViewer } from '@/lib/hooks/use-stream-viewer';
import { getStreamStatusByKey, StreamStatus } from '@/lib/api/streaming';
import { Display, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { NoticeBox } from '@/components/notices/NoticeBox';
import { LiveChat } from '@/components/live/LiveChat';
import { ProductCarousel, LiveProduct } from '@/components/live/ProductCarousel';
import { ProductOptionModal } from '@/components/live/ProductOptionModal';
import { apiClient } from '@/lib/api/client';
import { useCart } from '@/lib/contexts/CartContext';

export default function LiveStreamPage() {
  const params = useParams();
  const router = useRouter();
  const streamKey = params.streamKey as string;

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<LiveProduct | null>(null);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);

  const isLive = streamStatus?.status === 'LIVE';
  const { viewerCount } = useStreamViewer(streamKey, isLive);

  // Fetch initial stream status
  useEffect(() => {
    const fetchStreamStatus = async () => {
      try {
        const status = await getStreamStatusByKey(streamKey);
        setStreamStatus(status);
      } catch (err: any) {
        console.error('Failed to fetch stream status:', err);
        setError('Failed to load stream information');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreamStatus();
  }, [streamKey]);

  // Poll for stream status updates every 30 seconds
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const status = await getStreamStatusByKey(streamKey);
        setStreamStatus(status);

        // If stream went offline, show end message
        if (status.status === 'OFFLINE') {
          setStreamEnded(true);
        }
      } catch (err) {
        console.error('Failed to poll stream status:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [streamKey, isLive]);

  const handleStreamEnded = () => {
    setStreamEnded(true);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  // Fetch products for this stream
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // TODO: Add API endpoint to get products by streamKey
        // For now, fetch all ACTIVE products
        const response = await apiClient.get<LiveProduct[]>('/products?status=ACTIVE');
        setProducts(response.data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };

    if (isLive) {
      fetchProducts();
    }
  }, [isLive, streamKey]);

  const handleProductClick = (product: LiveProduct) => {
    setSelectedProduct(product);
    setIsOptionModalOpen(true);
  };

  const { addItem } = useCart();

  const handleAddToCart = (product: LiveProduct, quantity: number, options?: any) => {
    // Add to cart with 10-minute timer
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
      stock: product.stock,
    });

    // Navigate to cart page
    router.push('/cart');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">Loading stream...</Body>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <Display className="text-error mb-4">Error</Display>
          <Body className="text-secondary-text mb-6">{error}</Body>
          <Button variant="primary" onClick={handleBackToHome}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (streamEnded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <Display className="text-hot-pink mb-4">Stream has ended</Display>
          <Body className="text-secondary-text mb-6">Thank you for watching!</Body>
          <Button variant="primary" onClick={handleBackToHome}>
            Back to Store
          </Button>
        </div>
      </div>
    );
  }

  if (!isLive || !streamStatus) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <Display className="text-hot-pink mb-4">Stream Not Available</Display>
          <Body className="text-secondary-text mb-6">
            This stream is not currently live. Check back soon!
          </Body>
          <Button variant="primary" onClick={handleBackToHome}>
            Back to Store
          </Button>
        </div>
      </div>
    );
  }

  // Construct HLS URL from stream key
  // In production, this would come from environment variables
  const hlsUrl = process.env.NEXT_PUBLIC_HLS_SERVER_URL
    ? `${process.env.NEXT_PUBLIC_HLS_SERVER_URL}/${streamKey}/index.m3u8`
    : `https://cdn.example.com/hls/${streamKey}/index.m3u8`;

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: 70/30 Layout | Mobile: Stacked */}
      <div className="w-full h-screen flex flex-col lg:flex-row">
        {/* Main Content Area (70% on desktop) */}
        <div className="flex-1 lg:w-[70%] flex flex-col overflow-hidden">
          {/* Video Player */}
          <div className="relative w-full aspect-video bg-black">
            <VideoPlayer
              streamKey={streamKey}
              hlsUrl={hlsUrl}
              isLive={isLive}
              viewerCount={viewerCount}
              onStreamEnded={handleStreamEnded}
            />
          </div>

          {/* Stream Info + Products */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
            <div className="max-w-4xl mx-auto">
              {/* Stream Title */}
              <div className="mb-4">
                <Display className="text-hot-pink mb-2">{streamStatus.title}</Display>
                <Body className="text-secondary-text">
                  Started {streamStatus.startedAt ? new Date(streamStatus.startedAt).toLocaleString() : 'recently'}
                </Body>
              </div>

              {/* Product Carousel */}
              <ProductCarousel
                streamKey={streamKey}
                products={products}
                onProductClick={handleProductClick}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar (Desktop) - Chat + Notice */}
        <div className="hidden lg:flex lg:flex-col lg:w-[30%] border-l border-content-bg overflow-hidden">
          {/* Chat (60% height) */}
          <div className="flex-[3] border-b border-gray-200 overflow-hidden">
            <LiveChat liveId={streamKey} streamKey={streamKey} />
          </div>

          {/* Notice (40% height) */}
          <div className="flex-[2] p-4 overflow-hidden">
            <NoticeBox />
          </div>
        </div>
      </div>

      {/* Mobile: Chat + Notice at bottom */}
      <div className="lg:hidden">
        {/* Mobile Chat */}
        <div className="h-[400px] border-t border-gray-200">
          <LiveChat liveId={streamKey} streamKey={streamKey} />
        </div>

        {/* Mobile Notice */}
        <div className="p-4 border-t border-gray-200">
          <NoticeBox />
        </div>
      </div>

      {/* Product Option Modal */}
      <ProductOptionModal
        isOpen={isOptionModalOpen}
        product={selectedProduct}
        onClose={() => setIsOptionModalOpen(false)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
