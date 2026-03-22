import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { UltronProvider } from '@/components/ultron-provider'
import './globals.css'


const inter = Inter({ subsets: ['latin'] })

const SITE_URL = 'https://ultron.live'
const TITLE = 'Ultron — AI-Powered Error Tracking'
const DESCRIPTION =
  'Lightweight error monitoring for developers and small teams. Catch JS errors, slow network requests, and web vitals — then let AI tell you exactly how to fix them.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | Ultron',
  },
  description: DESCRIPTION,
  keywords: [
    'error tracking', 'error monitoring', 'JavaScript errors', 'web vitals',
    'AI fix suggestions', 'bug tracking', 'performance monitoring',
    'session replay', 'network monitoring', 'developer tools',
  ],
  authors: [{ name: 'Ultron', url: SITE_URL }],
  creator: 'Ultron',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Ultron',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
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
