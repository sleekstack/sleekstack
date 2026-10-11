---
satisfies: [R8]
---
# fn-45-devtools-for-ui.4 ui-demo wiring and docs

## Description
ui-demo wiring and docs. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** apps/ui-demo/src/main.tsx, apps/docs/content/docs (new page + meta.json)
**Touches:** [apps/ui-demo/src/main.tsx, apps/docs/content/docs/**]

### Approach
- Pass the observer behind `import.meta.env.DEV` in the two existing mounts; add a docs page (api/next/devtools.md is generated: do not edit).

## Acceptance
- [ ] ui-demo opens the panels in development (R8)
- [ ] Docs page lists the four views


## Done summary
ui-demo creates a per-mount store and a `uiTrace()` observer behind `import.meta.env.DEV` and opens `<UiPanel>` in a separate React root (apps/ui-demo/src/devtools.tsx); `vite build` output has no devtools code. Added ADR 0037 (render observer design, with the instance-to-element dispose bug recorded as a known limitation), the "UI devtools" docs page listing the four views with a dev-only snippet, CONTEXT.md terms Render Observer / Render Event, and README rows. The ui-demo architecture test allows the new devtools file.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: docs snippet loaded devtools unconditionally, fixed; re-review SHIP)
baseline: green (prior tasks' gates at base)
## Evidence
- Commits: 3505afb7915a2d80c4bcd5ee6f10f7d9107e05c3, 04f6477f568f820bd57ee4c83177fe2f0e4d9493
- Tests: pnpm turbo run test typecheck build --filter=ui-demo, pnpm turbo run test typecheck --filter=docs, pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/devtools... --filter=@sleekstack/analyze --filter=sleekstack
- PRs: