# @sleekstack/next

Effect runtime management for Next.js: `configureRuntime({ layer, onError })` builds one runtime per process (HMR-safe), `runEffect(effect, { request, overrides })` runs an Effect on it, and `@sleekstack/next/devtools` exposes a dev-only scope/error buffer. `action`/`query` sugar lives in `@sleekstack/kit`.

Guides and the generated API reference live in the docs site ([`apps/docs`](../../apps/docs/README.md)): run `pnpm --filter docs dev` and open http://localhost:3000/docs.
