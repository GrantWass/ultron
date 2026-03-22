import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login'],
      disallow: ['/dashboard/', '/api/', '/invite/'],
    },
    sitemap: 'https://ultron.live/sitemap.xml',
  }
}
