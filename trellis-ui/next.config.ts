import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    // Grounded answers make several provider calls; uploads allow 20 MB plus multipart overhead.
    proxyTimeout: 600_000,
    proxyClientMaxBodySize: '24mb',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_ORIGIN || 'http://127.0.0.1:8100'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
