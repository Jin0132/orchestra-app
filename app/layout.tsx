import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _notoSansJP = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-noto-sans-jp" });

const APP_NAME = "Arsis Portal"
const APP_DESCRIPTION = "Arsis Chamber Orchestra 運営ポータル。セッティング表、エキストラ契約、団員ポータルを一元管理。"

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: 'Arsis Chamber Orchestra - オーケストラ運営プラットフォーム',
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#1a2744',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${_inter.variable} ${_notoSansJP.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
