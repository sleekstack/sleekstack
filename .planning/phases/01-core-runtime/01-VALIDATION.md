---
phase: 01
slug: core-runtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x + @testing-library/react |
| **Config file** | `vitest.config.ts` — none yet; Wave 0 installs |
| **Quick run command** | `pnpm -r --filter='@sleekstack/*' test run` |
| **Full suite command** | `pnpm -r test run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -r --filter='@sleekstack/*' test run`
- **After every plan wave:** Run `pnpm -r test run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-module-01 | core | 0 | CORE-01 | — | N/A | unit | `pnpm -r --filter='@sleekstack/core' test run` | ❌ W0 | ⬜ pending |
| 01-module-02 | core | 0 | CORE-02 | — | N/A | unit | `pnpm -r --filter='@sleekstack/core' test run` | ❌ W0 | ⬜ pending |
| 01-module-03 | core | 1 | CORE-03 | — | N/A | unit | `pnpm -r --filter='@sleekstack/core' test run` | ❌ W0 | ⬜ pending |
| 01-module-04 | core | 1 | CORE-04 | — | N/A | unit | `pnpm -r --filter='@sleekstack/core' test run` | ❌ W0 | ⬜ pending |
| 01-react-01 | react | 1 | REACT-01 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-02 | react | 1 | REACT-02 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-03 | react | 1 | REACT-03 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-04 | react | 1 | REACT-04 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-05 | react | 2 | REACT-05 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-06 | react | 2 | REACT-06 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-07 | react | 2 | REACT-07 | — | N/A | unit | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |
| 01-react-08 | react | 2 | REACT-08 | — | N/A | integration | `pnpm -r --filter='@sleekstack/react' test run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/__tests__/module.test.ts` — stubs for CORE-01, CORE-02, CORE-03, CORE-04
- [ ] `packages/react/src/__tests__/LayerProvider.test.tsx` — stubs for REACT-01 through REACT-08
- [ ] `packages/core/vitest.config.ts` — vitest config with jsdom environment
- [ ] `packages/react/vitest.config.ts` — vitest config with jsdom + @testing-library/react
- [ ] `vitest`, `@testing-library/react`, `@testing-library/react-hooks`, `jsdom` — not installed in any package; Wave 0 installs all

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Playground renders and resolves services in browser | D-08, D-09 | Requires running browser + Vite dev server | `cd apps/playground && pnpm dev`, open browser, verify `useService` resolves and displays service output |
| React Strict Mode double-invoke does not break lifecycle | REACT-08 | jsdom does not fully simulate Strict Mode double-invocation | Verify manually in playground with `<React.StrictMode>` wrapper |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
