'use client';

import { Header } from './Header';
import { LiveBanner } from './LiveBanner';
import { UpcomingLives } from './UpcomingLives';
import { Footer } from './Footer';
import { useMainPageData } from '@/lib/hooks/queries/use-mainpage';

export function FigmaHomePage() {
  const { data, isLoading } = useMainPageData();
  const currentLive = data?.currentLive ?? null;
  const upcomingLives = data?.upcomingLives ?? [];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:py-8 space-y-12 md:space-y-20">
        <section className="pt-2">
          <LiveBanner currentLive={currentLive} isLoading={isLoading} />
        </section>
        <section>
          <UpcomingLives upcomingLives={upcomingLives} isLoading={isLoading} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
