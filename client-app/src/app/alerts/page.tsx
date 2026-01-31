'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

interface StockAlert {
  id: string;
  name: string;
  imageUrl?: string;
  percentGone: number;
  badge: 'LOW STOCK' | 'VERY LOW' | 'SELLING FAST';
}

const mockAlerts: StockAlert[] = [
  {
    id: '1',
    name: 'Premium Headphones',
    percentGone: 80,
    badge: 'LOW STOCK',
  },
  {
    id: '2',
    name: 'Sneaker Release X',
    percentGone: 95,
    badge: 'VERY LOW',
  },
  {
    id: '3',
    name: 'Smartwatch Pro',
    percentGone: 50,
    badge: 'SELLING FAST',
  },
];

export default function AlertsPage() {
  const router = useRouter();

  return (
    <>
      <main className="min-h-screen bg-[#121212] pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white uppercase tracking-wide">
            LIMITED STOCK ALERTS
          </h1>
        </div>

        {/* Alert Cards */}
        <div className="px-4 space-y-6">
          {mockAlerts.map((alert) => (
            <div key={alert.id} className="space-y-3">
              {/* Product Name */}
              <h2 className="text-white font-bold text-base">{alert.name}</h2>

              {/* Image + Badge Row */}
              <div className="flex items-center justify-between">
                <div className="w-12 h-10 bg-[#2A2A2A] rounded-lg flex items-center justify-center">
                  {alert.imageUrl ? (
                    <img
                      src={alert.imageUrl}
                      alt={alert.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-[#555]" />
                  )}
                </div>
                <span className="bg-[#FF007A] text-white text-xs font-bold uppercase px-3 py-1.5 rounded-md">
                  {alert.badge}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#333] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF007A] to-[#FF3B30] transition-all"
                  style={{ width: `${alert.percentGone}%` }}
                />
              </div>

              {/* Labels */}
              <div className="flex justify-between items-center">
                <span className="text-[#888] text-xs uppercase">
                  {alert.percentGone}% GONE
                </span>
                <span className="text-[#888] text-xs uppercase">
                  {alert.badge}
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5" />
            </div>
          ))}
        </div>
      </main>

      <BottomTabBar />
    </>
  );
}
