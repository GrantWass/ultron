/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ultron/types'],
  async rewrites() {
    return [
      {
        source: '/google:token\\.html',
        destination: '/api/google-verification/:token',
      },
    ]
  },
}

export default nextConfig
