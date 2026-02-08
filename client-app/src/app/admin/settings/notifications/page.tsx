'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { Save, AlertCircle } from 'lucide-react';

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<NotificationTemplate[]>('/admin/notification-templates');
      setTemplates(response.data);
    } catch (err: any) {
      console.error('Failed to fetch templates:', err);
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (id: string, newTemplate: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, template: newTemplate } : t))
    );
  };

  const handleSave = async (template: NotificationTemplate) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.patch(`/admin/notification-templates/${template.id}`, {
        template: template.template,
      });
      setSuccessMessage(`Template "${template.name}" saved successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save template:', err);
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailableVariables = (type: string): string[] => {
    const commonVars = ['{customerName}', '{orderId}'];

    switch (type) {
      case 'ORDER_CONFIRMATION':
        return [...commonVars, '{amount}', '{depositorName}'];
      case 'PAYMENT_REMINDER':
        return [...commonVars, '{amount}', '{depositorName}'];
      case 'PAYMENT_CONFIRMED':
        return [...commonVars, '{amount}'];
      case 'SHIPPED':
        return [...commonVars, '{trackingNumber}'];
      case 'RESERVATION_PROMOTED':
        return [...commonVars, '{productName}'];
      default:
        return commonVars;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">Loading templates...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">Notification Templates</Display>
          <Body className="text-secondary-text">
            Customize KakaoTalk notification messages sent to customers
          </Body>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <Body className="text-error flex-1">{error}</Body>
          </div>
        )}

        {successMessage && (
          <div className="bg-success-bg border border-success/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Save className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <Body className="text-success flex-1">{successMessage}</Body>
          </div>
        )}

        <div className="space-y-6">
          {templates.map((template) => {
            const variables = getAvailableVariables(template.type);

            return (
              <div
                key={template.id}
                className="bg-content-bg rounded-2xl p-6 border border-white/5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Heading2 className="text-primary-text mb-1">{template.name}</Heading2>
                    <Body className="text-secondary-text text-sm">{template.type}</Body>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSave(template)}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-text mb-2">
                    Message Template
                  </label>
                  <textarea
                    value={template.template}
                    onChange={(e) => handleTemplateChange(template.id, e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-hot-pink focus:ring-2 focus:ring-hot-pink/20 resize-none font-mono text-sm"
                    placeholder="Enter your notification template..."
                  />
                </div>

                <div className="bg-info-bg rounded-lg p-3">
                  <Body className="text-primary-text text-sm font-semibold mb-2">
                    Available Variables:
                  </Body>
                  <div className="flex flex-wrap gap-2">
                    {variables.map((variable) => (
                      <code
                        key={variable}
                        className="px-2 py-1 bg-info/10 text-info rounded text-xs font-mono"
                      >
                        {variable}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-16">
            <Body className="text-secondary-text mb-4">
              No notification templates found. Templates will be created automatically when the system is initialized.
            </Body>
          </div>
        )}

        <div className="mt-8">
          <Button variant="outline" size="lg" onClick={() => router.push('/admin/settings')}>
            Back to Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
