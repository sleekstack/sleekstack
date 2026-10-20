---
satisfies: [R1]
---
# fn-65-file-routes-page-config-layouts-routing.1 Router: optional and splat segments in match and Params

Touches: packages/router/src/index.ts, packages/router/src/__tests__/router.test.ts, packages/router/src/__tests__/params.test-d.ts, packages/router/README.md, apps/docs/content/docs/routing.mdx

## Description
Teach `match` and `Params` the last-segment patterns `:name?` (optional) and `*name` (splat) so a file route table can use them. Hand-written tables get them too (ADR 0036: same types either way).

**Size:** M
**Files:** `packages/router/src/index.ts`, `packages/router/src/__tests__/router.test.ts`, `packages/router/src/__tests__/params.test-d.ts`, `packages/router/README.md`, `apps/docs/content/docs/routing.mdx`

### Approach
- `match` (`index.ts` ~44-62) compares `pattern.length !== actual.length` and treats `:x` as a whole-segment param; `Segment<S>` / `Params<P>` (`index.ts:3-13`) read `:name`. Extend both. Tests first: runtime cases in `router.test.ts`, type cases in `params.test-d.ts` (follow its existing style).
- Contract: `:name?` as the last pattern segment matches the path with or without it (`params.name` absent when missing); `*name` as the last segment matches one or more remaining segments, each percent-decoded, joined with `/` in `params.name`; zero segments does not match. A pattern with `?` or `*` anywhere but last never matches. Types: `Params<'/files/*path'>` is `{ readonly path: string }`; `Params<'/u/:id?'>` is `{ readonly id?: string }`; non-literal `string` keeps `Record<string, string>`.
- Precedence between hand-written patterns stays table order (the plugin sorts file routes in task 2). A malformed escape still matches nothing; `%2F` stays inside one segment.
- `Link`, `prefetchLoader` and `handle` only call `match`; no change expected, check `link.test.ts` still passes.
- Document the two patterns in the README table row for `match` and in `routing.mdx`.

### Investigation targets
**Required**:
- `packages/router/src/index.ts:1-80`
- `packages/router/src/__tests__/router.test.ts`, `params.test-d.ts`
- `docs/adr/0036-router-const-route-table.md`

### Acceptance
- [ ] Optional: matches with and without the segment, param absent when missing, mid-path `?` never matches
- [ ] Splat: one or more segments, decoded per segment, joined with `/`; zero segments and mid-path `*` never match; malformed escape matches nothing
- [ ] Type tests: `Params` for `:id?` and `*path`, literal paths keep their types, `string` stays a record
- [ ] README and routing.mdx describe both patterns
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/router...` green

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
