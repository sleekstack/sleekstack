---
satisfies: [R4, R5]
---
# fn-20-adx-agent-developer-experience.5 llms.md in kit package, drift test, and sleekstack init-agents

## Description
Ship the agent docs with the package and let consumers point their AGENTS.md at them. Written last: it lists fn-16 kit facade names, the error table and the renamed export.

**Size:** M
**Files:** packages/kit/llms.md (new), packages/kit/package.json, packages/kit/src/__tests__/ (pack + drift tests), packages/cli/src/check.ts (dispatch), packages/cli/src/initAgents.ts (new), packages/cli/src/__tests__/
**Touches:** [packages/kit/llms.md, packages/kit/package.json, packages/kit/src/__tests__/**, packages/cli/src/**]

### Approach
- kit has no `files` field (`packages/kit/package.json`); add one that includes `llms.md` plus dist/types; verify with a pack dry-run test. cli already has `files`.
- llms.md: under 8KB (bytes); the error section is generated from the task-2 table, with a drift test; patterns, lifetime matrix and vocabulary are hand-written (vocab from CONTEXT.md).
- init-agents: resolve `@sleekstack/kit/llms.md` through node resolution; marker comments; atomic write; stop on unbalanced/duplicate markers; preserve CRLF; clear error on read-only.

## Acceptance
- [ ] pack dry-run lists llms.md plus dist and types; llms.md under 8KB
- [ ] drift test fails when table and llms.md disagree
- [ ] init-agents idempotent; bad-marker, read-only and CRLF cases tested

## Done summary
packages/kit/llms.md (5.8KB; entry points, patterns, lifetime matrix, vocab, generated error section) + files/exports fields; pack dry-run + size test in kit, drift test in analyze (kit cannot import analyze: rootDir/dep direction). sleekstack init-agents: marker block in AGENTS.md pointing at node_modules/@sleekstack/kit/llms.md; idempotent, atomic, CRLF, bad-marker, read-only, missing-kit tested.
## Evidence
- Commits: 37101371e8093cf49ebef961c8c4ee92939ce678
- Tests: vitest+tsc packages/kit, packages/analyze, packages/cli
- PRs: