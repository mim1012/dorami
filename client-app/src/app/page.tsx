import { Suspense } from 'react';
import { FigmaHomePage } from '@/components/figma-home/FigmaHomePage';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { MainPageSkeleton } from '@/components/mainpage/MainPageSkeleton';

export default function Home() {
  return (
    <div className="home-page">
      <Suspense fallback={<MainPageSkeleton />}>
        <FigmaHomePage />
      </Suspense>
      <BottomTabBar />
    </div>
  );
}
