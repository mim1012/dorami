'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Coins, Save } from 'lucide-react';

interface PointsConfig {
  pointsEnabled: boolean;
  pointEarningRate: number;
  pointMinRedemption: number;
  pointMaxRedemptionPct: number;
  pointExpirationEnabled: boolean;
  pointExpirationMonths: number;
}

export function PointsConfiguration() {
  const [config, setConfig] = useState<PointsConfig>({
    pointsEnabled: false,
    pointEarningRate: 5,
    pointMinRedemption: 1000,
    pointMaxRedemptionPct: 50,
    pointExpirationEnabled: false,
    pointExpirationMonths: 12,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await apiClient.get<PointsConfig>('/admin/config/points');
        setConfig(response.data);
      } catch (err) {
        console.error('Failed to load points config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await apiClient.put<PointsConfig>('/admin/config/points', config);
      setConfig(response.data);
      setSuccessMessage('포인트 설정이 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save points config:', err);
      setError(err.message || '설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const exampleOrderTotal = 50000;
  const exampleEarning = Math.floor(exampleOrderTotal * config.pointEarningRate / 100);
  const exampleMaxUsage = Math.floor(exampleOrderTotal * config.pointMaxRedemptionPct / 100);

  if (isLoading) {
    return (
      <div className="bg-content-bg rounded-button p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-content-bg rounded-button p-6">
      <div className="flex items-center gap-3 mb-4">
        <Coins className="w-6 h-6 text-hot-pink" />
        <Heading2 className="text-primary-text">적립 포인트 설정</Heading2>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-button p-3 mb-4">
          <Caption className="text-green-800">{successMessage}</Caption>
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error rounded-button p-3 mb-4">
          <Caption className="text-error">{error}</Caption>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="pointsEnabled"
            checked={config.pointsEnabled}
            onChange={(e) => setConfig({ ...config, pointsEnabled: e.target.checked })}
            className="w-5 h-5 text-hot-pink focus:ring-hot-pink border-gray-300 rounded"
          />
          <label htmlFor="pointsEnabled" className="cursor-pointer">
            <Body className="text-primary-text font-medium">포인트 시스템 활성화</Body>
            <Caption className="text-secondary-text">
              활성화하면 구매 시 포인트가 적립되고 사용할 수 있습니다
            </Caption>
          </label>
        </div>

        {config.pointsEnabled && (
          <>
            <div>
              <Input
                label="포인트 적립률 (%)"
                type="number"
                min={0}
                max={100}
                value={config.pointEarningRate}
                onChange={(e) =>
                  setConfig({ ...config, pointEarningRate: parseInt(e.target.value) || 0 })
                }
                fullWidth
              />
              <Caption className="text-secondary-text mt-1">
                주문 금액 대비 적립 비율 (0~100%)
              </Caption>
            </div>

            <div>
              <Input
                label="최소 사용 포인트"
                type="number"
                min={0}
                value={config.pointMinRedemption}
                onChange={(e) =>
                  setConfig({ ...config, pointMinRedemption: parseInt(e.target.value) || 0 })
                }
                fullWidth
              />
              <Caption className="text-secondary-text mt-1">
                결제 시 사용 가능한 최소 포인트
              </Caption>
            </div>

            <div>
              <Input
                label="최대 사용 비율 (% / 주문금액)"
                type="number"
                min={1}
                max={100}
                value={config.pointMaxRedemptionPct}
                onChange={(e) =>
                  setConfig({ ...config, pointMaxRedemptionPct: parseInt(e.target.value) || 50 })
                }
                fullWidth
              />
              <Caption className="text-secondary-text mt-1">
                주문 금액 대비 포인트 최대 사용 비율 (1~100%)
              </Caption>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="pointExpirationEnabled"
                checked={config.pointExpirationEnabled}
                onChange={(e) =>
                  setConfig({ ...config, pointExpirationEnabled: e.target.checked })
                }
                className="w-5 h-5 text-hot-pink focus:ring-hot-pink border-gray-300 rounded"
              />
              <label htmlFor="pointExpirationEnabled" className="cursor-pointer">
                <Body className="text-primary-text">포인트 만료 활성화</Body>
              </label>
            </div>

            {config.pointExpirationEnabled && (
              <div>
                <Input
                  label="만료 기간 (개월)"
                  type="number"
                  min={1}
                  max={120}
                  value={config.pointExpirationMonths}
                  onChange={(e) =>
                    setConfig({ ...config, pointExpirationMonths: parseInt(e.target.value) || 12 })
                  }
                  fullWidth
                />
                <Caption className="text-secondary-text mt-1">
                  적립일로부터 해당 기간이 지나면 포인트가 소멸됩니다
                </Caption>
              </div>
            )}

            <div className="bg-gray-50 rounded-button p-4 border border-gray-200">
              <Body className="text-primary-text font-medium mb-2">적용 예시</Body>
              <Caption className="text-secondary-text">
                {new Intl.NumberFormat('ko-KR').format(exampleOrderTotal)}원 주문 시:
              </Caption>
              <div className="mt-2 space-y-1">
                <Caption className="text-primary-text">
                  적립 포인트: <span className="text-green-600 font-medium">{new Intl.NumberFormat('ko-KR').format(exampleEarning)} P</span>
                </Caption>
                <Caption className="text-primary-text">
                  최대 사용 가능: <span className="text-blue-600 font-medium">{new Intl.NumberFormat('ko-KR').format(exampleMaxUsage)} P</span>
                </Caption>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? '저장 중...' : '포인트 설정 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
