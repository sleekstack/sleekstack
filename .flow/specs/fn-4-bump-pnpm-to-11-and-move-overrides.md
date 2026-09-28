# Bump pnpm to 11 and move overrides to pnpm-workspace.yaml

## Overview
The repo pins `pnpm@10.0.0`, but local installs run pnpm 11, which warns that it ignores `package.json` `pnpm.overrides` before delegating to 10.0.0. Move to pnpm 11 as the pinned version, with its settings in `pnpm-workspace.yaml`, so the warning goes away and the security overrides stay applied. Runs after fn-3.

## Quick commands
```bash
pnpm install --frozen-lockfile
grep -A5 '^overrides:' pnpm-lock.yaml
pnpm typecheck && pnpm test
```

## Boundaries / non-goals
- No dependency upgrades beyond what the pnpm bump itself requires.
- No change to the override ranges.

## Decision context
- Moving the overrides alone is not an option: pnpm 10.0.0 doesn't read overrides from `pnpm-workspace.yaml`, and the resolution regressed to postcss 8.4.31 and sharp 0.34.5 when that was tried. The bump and the move must land together.

## Acceptance Criteria
- **R1:** `packageManager` pins a pnpm 11 release. `pnpm-workspace.yaml` holds `overrides` (postcss, nanoid, sharp, baseline-browser-mapping, with unchanged ranges) and any other settings that moved out of `package.json`, such as `onlyBuiltDependencies`. The `pnpm` field is removed from `package.json`. Errors: an install prints no "no longer read" warning; the lockfile resolves postcss ≥8.5.23, sharp ≥0.35.4, nanoid ≥3.3.18 <4 and baseline-browser-mapping ≥2.11.0.
- **R2:** CI (pnpm/action-setup reads `packageManager`) installs with the frozen lockfile and passes the build and e2e jobs. Errors: no "Multiple versions" pnpm error.
- **R3:** Docs name pnpm 11 wherever a pnpm version or install step is given: the root README, the app/package READMEs and CONTRIBUTING if present. Errors: n/a.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | pnpm 11 pin + overrides moved | .1 | — |
| R2 | CI green | .1 | — |
| R3 | docs | .1 | — |
