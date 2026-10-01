import type { NextConfig } from 'next'

// The workspace packages ship TS sources (`main: src/index.ts(x)`, no build
// step of their own); transpilePackages tells Next's bundler to compile them
// as part of this app's build instead of expecting pre-built JS.
const nextConfig: NextConfig = {
  transpilePackages: ['@sleekstack/core', '@sleekstack/next', '@sleekstack/runtime', '@sleekstack/react', '@sleekstack/devtools'],
}

export default nextConfig
