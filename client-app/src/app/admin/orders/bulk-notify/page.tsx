'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { Upload, CheckCircle, XCircle, FileText, Download } from 'lucide-react';

interface BulkNotificationResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    orderId: string;
    success: boolean;
    error?: string;
  }>;
}

export default function BulkNotifyPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<BulkNotificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiClient.post<BulkNotificationResult>(
        '/admin/orders/bulk-notify',
        formData
      );

      setResult(response.data);
      setSelectedFile(null);

      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err: any) {
      console.error('Failed to send bulk notifications:', err);
      setError(
        err.response?.data?.message || 'Failed to send notifications. Please check your CSV format.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = 'Order ID,Tracking Number\nORD-20250201-001,1234567890\nORD-20250201-002,0987654321';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample-tracking-numbers.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">Bulk Shipping Notifications</Display>
          <Body className="text-secondary-text">
            Send tracking number notifications to multiple customers at once
          </Body>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <Heading2 className="text-blue-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            How to use
          </Heading2>
          <div className="space-y-2">
            <Body className="text-blue-800 text-sm">
              1. Download the sample CSV template below
            </Body>
            <Body className="text-blue-800 text-sm">
              2. Fill in your Order IDs and Tracking Numbers
            </Body>
            <Body className="text-blue-800 text-sm">
              3. Upload the CSV file and click &quot;Send Notifications&quot;
            </Body>
            <Body className="text-blue-800 text-sm font-semibold mt-3">
              Note: Only orders with confirmed payment status will receive notifications
            </Body>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSampleCSV}
            className="mt-4 border-blue-600 text-blue-600 hover:bg-blue-100"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Sample CSV
          </Button>
        </div>

        {/* Upload Section */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <Heading2 className="text-primary-text mb-4">Upload CSV File</Heading2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="csv-file"
                className="block text-sm font-medium text-primary-text mb-2"
              >
                Select CSV File
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-primary-text
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-hot-pink file:text-white
                  hover:file:bg-hot-pink/90
                  cursor-pointer"
              />
            </div>

            {selectedFile && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <Body className="text-green-800 text-sm">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </Body>
              </div>
            )}

            {error && (
              <div className="bg-error/10 border border-error rounded-lg p-3 flex items-start gap-2">
                <XCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <Body className="text-error text-sm">{error}</Body>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                {isUploading ? 'Sending...' : 'Send Notifications'}
              </Button>
              <Button variant="outline" size="lg" onClick={() => router.push('/admin/orders')}>
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-content-bg rounded-2xl p-6 border border-white/5">
            <Heading2 className="text-primary-text mb-4">Results</Heading2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white/50 rounded-lg p-4 text-center">
                <Body className="text-secondary-text text-sm mb-1">Total</Body>
                <Display className="text-primary-text">{result.total}</Display>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                <Body className="text-green-700 text-sm mb-1">Successful</Body>
                <Display className="text-green-600">{result.successful}</Display>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                <Body className="text-red-700 text-sm mb-1">Failed</Body>
                <Display className="text-red-600">{result.failed}</Display>
              </div>
            </div>

            {result.failed > 0 && (
              <div className="bg-white/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <Heading2 className="text-error mb-3">Failed Orders</Heading2>
                <div className="space-y-2">
                  {result.results
                    .filter((r) => !r.success)
                    .map((r, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-error/5 rounded-lg"
                      >
                        <Body className="text-primary-text font-mono text-sm">{r.orderId}</Body>
                        <Body className="text-error text-sm">{r.error}</Body>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
