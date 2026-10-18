---
satisfies: [R3, R4]
---
# fn-31-hmr-that-keeps-component-state.3 Vite plugin hmr option: acceptUpdate transform, reload fallback, guest exclusion + docs

## Description
Wire the runtime to Vite: the transform emits `acceptUpdate` for component-only modules, anything else falls back to full reload, React guests are untouched. Depends on fn-29 (plugin package exists); only task 1 within this spec.

**Size:** M
**Files:** the fn-29 plugin package (`packages/ui-vite/src/*`, name per fn-29), its tests, docs for the `hmr` option
**Touches:** [packages/ui-vite/**, apps/docs/content/docs/**]

### Approach
- Add plugin option `hmr: boolean`, default on in dev, off in build/production.
- Transform: for pragma'd ui modules whose exports are all components, append an `import.meta.hot.accept` handler calling `acceptUpdate(id, fn)` with the fn-29 stable id.
- Modules exporting anything non-component: `import.meta.hot.invalidate()` / full reload.
- Guest (React) modules are skipped by the transform so React Fast Refresh keeps owning them.
- Check the real package path and name against fn-29's output before starting.

### Investigation targets
**Required**:
- fn-29 plugin package (transform entry, id generation)
- packages/ui/src/index.ts — `acceptUpdate` export from task 1

## Acceptance
- [ ] Component-only edit in a dev app hot-updates preserving state (transform test plus runtime test)
- [ ] Non-component edit triggers a full reload
- [ ] A React guest module output has no `acceptUpdate`; Fast Refresh behavior unchanged
- [ ] `hmr: false` and production build emit no HMR code
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/ui-vite...` passes; docs mention the option

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
