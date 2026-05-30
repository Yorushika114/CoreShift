import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CoreShift - 语音日历',
  description: '以语音为核心入口的日历管理工具',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CoreShift',
  },
  formatDetection: { telephone: false },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
