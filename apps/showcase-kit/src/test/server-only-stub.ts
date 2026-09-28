// Vitest alias target for the `server-only` package (see vitest.config.ts):
// an empty module so `*.server.ts` files can be imported directly from tests
// without Next's actual bundler-only enforcement getting in the way.
export {}
