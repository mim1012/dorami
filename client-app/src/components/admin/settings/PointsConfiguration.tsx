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
      setSuccessMessage('Points configuration saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save points config:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Example calculation
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
        <Heading2 className="text-primary-text">Reward Points System</Heading2>
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
        {/* Enable/Disable Toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="pointsEnabled"
            checked={config.pointsEnabled}
            onChange={(e) => setConfig({ ...config, pointsEnabled: e.target.checked })}
            className="w-5 h-5 text-hot-pink focus:ring-hot-pink border-gray-300 rounded"
          />
          <label htmlFor="pointsEnabled" className="cursor-pointer">
            <Body className="text-primary-text font-medium">Enable Points System</Body>
            <Caption className="text-secondary-text">
              When enabled, customers earn points on purchases and can redeem them
            </Caption>
          </label>
        </div>

        {config.pointsEnabled && (
          <>
            {/* Earning Rate */}
            <div>
              <Input
                label="Point Earning Rate (%)"
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
                Percentage of order total earned as points (0-100%)
              </Caption>
            </div>

            {/* Minimum Redemption */}
            <div>
              <Input
                label="Minimum Points for Redemption"
                type="number"
                min={0}
                value={config.pointMinRedemption}
                onChange={(e) =>
                  setConfig({ ...config, pointMinRedemption: parseInt(e.target.value) || 0 })
                }
                fullWidth
              />
              <Caption className="text-secondary-text mt-1">
                Minimum points required to use at checkout
              </Caption>
            </div>

            {/* Max Redemption Percentage */}
            <div>
              <Input
                label="Maximum Redemption (% of Order)"
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
                Maximum percentage of order total that can be paid with points (1-100%)
              </Caption>
            </div>

            {/* Expiration Toggle */}
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
                <Body className="text-primary-text">Enable Point Expiration</Body>
              </label>
            </div>

            {config.pointExpirationEnabled && (
              <div>
                <Input
                  label="Expiration Period (months)"
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
                  Points will expire after this many months from earning
                </Caption>
              </div>
            )}

            {/* Preview Calculation */}
            <div className="bg-gray-50 rounded-button p-4 border border-gray-200">
              <Body className="text-primary-text font-medium mb-2">Example Calculation</Body>
              <Caption className="text-secondary-text">
                For an order of {new Intl.NumberFormat('ko-KR').format(exampleOrderTotal)} KRW:
              </Caption>
              <div className="mt-2 space-y-1">
                <Caption className="text-primary-text">
                  Points earned: <span className="text-green-600 font-medium">{new Intl.NumberFormat('ko-KR').format(exampleEarning)} P</span>
                </Caption>
                <Caption className="text-primary-text">
                  Max points usable: <span className="text-blue-600 font-medium">{new Intl.NumberFormat('ko-KR').format(exampleMaxUsage)} P</span>
                </Caption>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Points Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
