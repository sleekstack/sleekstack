---
satisfies: [R1, R4]
---
# fn-26-built-private-package-for-sleekstackui.3 build ui: four subpath exports, JSX types, peers

## Description
Points ui `main`/`types`/`exports` at dist for `.`, `./jsx-runtime`, `./jsx-dev-runtime`, `./query`; `effect` moves to peerDependencies (plus devDependencies).

**Size:** M
**Files:** packages/ui/package.json, packages/ui/tsconfig.build.json
**Touches:** [packages/ui/package.json, packages/ui/tsconfig.build.json]

### Approach
- exports condition order: `types` before `default`; emitted d.ts must carry the JSX namespace for `@jsxImportSource @sleekstack/ui`.
- Peer range: use one `effect` range across ui/core/query and keep ui-demo's ^3.21.2 compatible.

### Investigation targets
**Required** (read before coding):
- packages/ui/package.json exports
- apps/ui-demo vite.config.ts and jsx imports

## Acceptance
- [ ] `pnpm build` emits dist for all three; types resolve for JSX (R1).
- [ ] `effect` is a peer in ui's manifest (R4).

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
