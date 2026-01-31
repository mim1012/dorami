import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { QueryProvider } from '@/lib/providers/query-provider';
import { CartProvider } from '@/lib/contexts/CartContext';

export const metadata: Metadata = {
  title: 'Live Commerce',
  description: 'Live commerce platform with real-time shopping',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-white" suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
