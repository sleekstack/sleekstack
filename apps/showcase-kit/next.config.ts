import type { NextConfig } from 'next'

// Workspace packages ship TS sources; kit re-lowers onto core/next/react, so all four are compiled here.
const nextConfig: NextConfig = {
  transpilePackages: [
    '@sleekstack/kit',
    '@sleekstack/core',
    '@sleekstack/next',
    '@sleekstack/runtime',
    '@sleekstack/react',
    '@sleekstack/islands',
  ],
}

export default nextConfig
