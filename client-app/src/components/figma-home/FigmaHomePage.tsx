'use client';

import { Header } from './Header';
import { LiveBanner } from './LiveBanner';
import { LiveExclusiveDeals } from './LiveExclusiveDeals';
import { UpcomingLives } from './UpcomingLives';
import { PopularProducts } from './PopularProducts';
import { Footer } from './Footer';
import { useMainPageData } from '@/lib/hooks/queries/use-mainpage';

export function FigmaHomePage() {
  const { data, isLoading, isError } = useMainPageData();
  const liveDeals = data?.liveDeals ?? [];
  const upcomingLives = data?.upcomingLives ?? [];
  const popularProducts = data?.popularProducts ?? [];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:py-8 space-y-12 md:space-y-20">
        <section className="pt-2">
          <LiveBanner />
        </section>
        <section>
          <LiveExclusiveDeals liveDeals={liveDeals} isLoading={isLoading} />
        </section>
        <section>
          <UpcomingLives upcomingLives={upcomingLives} isLoading={isLoading} />
        </section>
        <section>
          <PopularProducts products={popularProducts} isLoading={isLoading} isError={isError} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
