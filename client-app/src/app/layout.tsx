import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme/theme-context';

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
    <html lang="ko" className="dark">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
