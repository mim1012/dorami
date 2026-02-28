'use client';

import { FigmaHomePage } from '@/components/figma-home/FigmaHomePage';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

export default function Home() {
  return (
    <div className="home-page">
      <FigmaHomePage />
      <BottomTabBar />
    </div>
  );
}
