import { createMDX } from 'fumadocs-mdx/next'

/** @type {import('next').NextConfig} */
const config = {
  // Snippets import workspace packages that ship TS sources.
  transpilePackages: ['@sleekstack/kit', '@sleekstack/core', '@sleekstack/next', '@sleekstack/react'],
}

export default createMDX()(config)
