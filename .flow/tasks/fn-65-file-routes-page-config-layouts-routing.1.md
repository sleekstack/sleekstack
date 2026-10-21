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
`match` and `Params` now accept `:name?` (optional, last segment; param absent when missing) and `*name` (splat, last segment; one or more non-empty segments, decoded per segment, joined with `/`); either one mid-path never matches, and a malformed escape still matches nothing. Root path segments became `[]` so `/:id?` matches `/`. Tests: `router.test.ts` match tables (optional, splat, zero-segment splat, empty-segment splat, malformed escape in a splat, mid-path optional/splat) and `params.test-d.ts` (`:id?`, `*path`, mixed, `string` record). README and routing.mdx document both patterns.

Note: an unrelated `pnpm-lock.yaml` change (an `apps/sleek-codes` importer) appeared in the worktree during the run; it is not from this task and was left uncommitted.

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out, 3 draws SHIP, rid 772a9104608a475fa53649681fc1b16a)
## Evidence
- Commits: 2a2e5ad2a39c5f24ae0def559ed1d0bbecbbb5f7
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld
- PRs: