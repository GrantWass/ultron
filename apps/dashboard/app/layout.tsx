import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { UltronProvider } from '@/components/ultron-provider'
import './globals.css'


const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ultron — Error Tracker',
  description: 'AI-powered error tracking and fix suggestions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UltronProvider />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
