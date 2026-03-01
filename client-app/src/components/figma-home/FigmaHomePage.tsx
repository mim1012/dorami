'use client';

import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { LiveBanner } from './LiveBanner';
import { UpcomingLives } from './UpcomingLives';
import { PastProducts } from './PastProducts';
import { Footer } from './Footer';
import { useMainPageData } from '@/lib/hooks/queries/use-mainpage';
import { getPastProducts } from '@/lib/api/mainpage';

export function FigmaHomePage() {
  const { data, isLoading } = useMainPageData();
  const upcomingLives = data?.upcomingLives ?? [];

  const { data: pastData, isLoading: isPastLoading } = useQuery({
    queryKey: ['past-products'],
    queryFn: () => getPastProducts(1, 8),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  const pastProducts = pastData?.data ?? [];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:py-8 space-y-12 md:space-y-20">
        <section className="pt-2">
          <LiveBanner />
        </section>
        <section>
          <UpcomingLives upcomingLives={upcomingLives} isLoading={isLoading} />
        </section>
        <section>
          <PastProducts products={pastProducts} isLoading={isPastLoading} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
