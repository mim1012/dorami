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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-[#121212]" suppressHydrationWarning>
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
