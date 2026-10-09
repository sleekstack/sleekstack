---
satisfies: [R1, R2, R6, R10, R13, R14, R15]
---
# fn-43-typed-dom-for-sleekstackui.1 Per-tag attribute types

## Description
Per-tag attribute types. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/jsx-runtime.ts (JSX namespace), a new types module under packages/ui/src, packages/ui/src/__tests__/jsx-types.test-d.ts
**Touches:** [packages/ui/src/jsx-runtime.ts, packages/ui/src/jsx-types.ts, packages/ui/src/__tests__/*.test-d.ts]

### Approach
- Replace the `[tag: string]: Props` index in `JSX.IntrinsicElements` with a map keyed by HTML (and SVG-only) tag names, built from the platform tag maps plus a small hand-written attribute table (fn-35.D1); keep a hyphenated-tag fallback.
- Attribute value type = string | number | boolean | null | undefined | Atom of those; `class` canonical, `className`/`htmlFor` aliases that forbid the canonical twin (mutually exclusive types).
- Follow the existing type-test style (`errors.test-d.ts`, `requirements.test-d.ts`) with `@ts-expect-error` negatives.

## Acceptance
- [ ] A misspelled attribute and a wrong value type on a known tag fail type-check (R1)
- [ ] class/className and for/htmlFor accepted, both together rejected (R2, R15)
- [ ] aria-* and data-* accepted on every element (R6)
- [ ] Atoms, numbers, booleans and null accepted as values (R10)
- [ ] A shared HTML/SVG tag name resolves to HTML; a hyphenated tag takes any props (R13, R14)


## Done summary
Host JSX is typed per tag: `JSX.IntrinsicElements` is a map over HTML tags (shared HTML/SVG names resolve to HTML) and SVG-only tags from the platform tag maps, plus a hand-written attribute table in packages/ui/src/jsx-types.ts. Values accept primitives, null/undefined and atoms; class/className and for/htmlFor are mutually exclusive; aria-*/data-* are global; hyphenated tags take any props. `on*` and `ref` are left loose for fn-43.2. Type tests: packages/ui/src/__tests__/jsx-types.test-d.tsx (.tsx, needed for JSX; checked by `tsc --noEmit`). The new types exposed one real mistake, fixed: ui-demo board.tsx `dateTime` -> `datetime`.

Known limit: without exactOptionalPropertyTypes, `class="a" className={undefined}` type-checks (undefined removes the attribute, so it is harmless).

stage: impl-review - ran (codex fan-out NEEDS_WORK, 3 findings fixed, re-review SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: ac9ba9713358aded5cacee7cd1660157c3bd2578, 43b5bcdf2e2f9a670b4254a2eabbad13f037394e
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui --filter=ui-demo
- PRs: