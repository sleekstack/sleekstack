# @sleekstack/islands

Lazy-hydrating React Islands for server-rendered apps (Next App Router first). Each Island server-renders in full and downloads and hydrates as its own React root on `load`, `idle`, `visible` (default) or `interaction`. Services come from `@sleekstack/kit`: `useService` works unchanged, and the app scope is shared across the Islands on a page.

```tsx
// islands.client.ts
'use client'
import { defineIslands } from '@sleekstack/islands'
export const Island = defineIslands({ counter: () => import('./Counter') }, { provide: [AppModule] })

// page.tsx (Server Component)
<Island name="counter" props={{ start: 3 }} hydrate="visible" provide={[CounterLayer]} />
```

Guide and v1 limits: `apps/docs/content/docs/islands.mdx`. Decision: [ADR 0010](../../docs/adr/0010-islands-over-resumability.md).

```bash
pnpm --filter @sleekstack/islands test
pnpm --filter @sleekstack/islands typecheck
```
