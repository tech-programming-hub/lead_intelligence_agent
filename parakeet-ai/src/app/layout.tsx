import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

const inter = Inter({ subsets: ['latin'] });
const BASE = process.env.NODE_ENV === 'production' ? '/lead_intelligence_agent' : '';

export const metadata: Metadata = {
  title: 'Parakeet AI',
  description: 'Your personal AI voice assistant powered by Claude',
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Parakeet',
  },
  icons: {
    apple: `${BASE}/icons/apple-touch-icon.png`,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <link rel="apple-touch-icon" href={`${BASE}/icons/apple-touch-icon.png`} />
      </head>
      <body className={`${inter.className} h-full overflow-hidden`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
