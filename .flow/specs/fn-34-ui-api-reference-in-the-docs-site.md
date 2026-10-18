## Goal & Context
<!-- scope: business -->

Generated API reference for `@sleekstack/ui` in the docs site. Small; can land at any time.

## Architecture & Data Models
<!-- scope: technical -->

The docs `generate:api` pipeline reads `src` types, so no build is needed: add `'ui'` to `PACKAGES` in `apps/docs/scripts/entry-points.mjs`, add the navigation entry and extend the coverage test. Never hand-edit generated files (AGENTS.md).

## API Contracts
<!-- scope: technical -->

No code API.

## Edge Cases & Constraints
<!-- scope: technical -->

Subpath entry points (`jsx-runtime`, `query`) appear once with one name per meaning (ADR 0019).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `generate:api` produces ui pages and the docs tests and build pass. Errors: a missing doc comment on a public export fails the existing coverage test.
- **R2:** The ui section appears in navigation.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run generate:api test typecheck --filter=docs`

## Boundaries
<!-- scope: business -->

No prose guides (the README and ADRs cover those).

## Decision Context
<!-- scope: both -->

Split from the original productize spec.
