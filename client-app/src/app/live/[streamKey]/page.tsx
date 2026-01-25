'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { useStreamViewer } from '@/lib/hooks/use-stream-viewer';
import { getStreamStatusByKey, StreamStatus } from '@/lib/api/streaming';
import { Display, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';

export default function LiveStreamPage() {
  const params = useParams();
  const router = useRouter();
  const streamKey = params.streamKey as string;

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <Body className="text-secondary-text">Loading stream...</Body>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-primary-black flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-primary-black flex items-center justify-center px-4">
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
    <div className="min-h-screen bg-primary-black">
      {/* Mobile-first layout */}
      <div className="w-full h-screen flex flex-col">
        {/* Video Player */}
        <div className="relative w-full lg:w-auto lg:max-w-[1280px] lg:mx-auto aspect-video">
          <VideoPlayer
            streamKey={streamKey}
            hlsUrl={hlsUrl}
            isLive={isLive}
            viewerCount={viewerCount}
            onStreamEnded={handleStreamEnded}
          />
        </div>

        {/* Stream Info */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Display className="text-hot-pink mb-2">{streamStatus.title}</Display>
            <Body className="text-secondary-text">
              Started {streamStatus.startedAt ? new Date(streamStatus.startedAt).toLocaleString() : 'recently'}
            </Body>

            {/* Placeholder for future features */}
            <div className="mt-8 p-6 bg-content-bg rounded-button">
              <Body className="text-secondary-text text-center">
                Chat and product listings will be available in future updates
              </Body>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
