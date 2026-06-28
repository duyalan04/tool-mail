import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Google Sheet Reader Tool',
  description: 'Đọc và xử lý dữ liệu từ Google Sheet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}