import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '定投回测系统',
  description: '基金定投回测工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

