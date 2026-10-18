---
satisfies: [R1, R2]
---
# fn-33-head-management-for-ui.1 HeadSink reference, Head component and DOM patching

## Description
Add `HeadSink` (Context.Reference, name `@sleekstack/ui/HeadSink`, modeled on `Handlers`/`Collector` at `reactive.ts:36-53`), the `<Head>` component, and the DOM-mode keyed patch of `document.head`: dedupe by key (`title`, `meta[name]`, `meta[property]`, `link[rel]+href`), deepest wins, removal on unmount. Head tag attrs go through `checkAttr`/`checkTag` (`string.ts:21-30`) and report like elements.

**Size:** M
**Files:** packages/ui/src/head.ts (new), packages/ui/src/index.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/__tests__/head.test.ts (new)
**Touches:** [packages/ui/src/head.ts, packages/ui/src/index.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/__tests__/head.test.ts]

### Approach
- Follow the `Boundary`/`Portal` export pattern in `jsx-runtime.ts`; unmount cleanup via `MountScope` (`reactive.ts:75`).
- Do not reuse the name `Collector`.
- Keyed-list case: a `Head` inside a keyed list dedupes by key, last mounted wins.

### Investigation targets
**Required**:
- `packages/ui/src/reactive.ts:36-80` - Reference and MountScope patterns
- `packages/ui/src/string.ts:21-40` - checkTag/checkAttr
- `packages/ui/src/dom.ts:394,538,648` - existing checkAttr call sites
- `packages/ui/src/jsx-runtime.ts` - Portal/Boundary component shape
**Optional**:
- `packages/ui/src/__tests__/portal.test.ts` - DOM test style

## Acceptance
- [ ] Title/meta/link set in DOM; nested override wins (R1)
- [ ] Invalid tag/attr rejected and reported (R1)
- [ ] Dedupe by each key kind; unmount removes and restores outer entry (R2)
- [ ] Conflicting titles and Head in keyed list covered by tests
- [ ] `exportNames.test` style uniqueness of the new public names holds

## Done summary
Added `<Head>` (title/meta/link) with a `HeadSink` Context.Reference and a keyed `document.head` patch: tags dedupe by `title`, `meta[name]`, `meta[property]`, `link[rel]+href`; the deepest Head wins (instance depth now on `RunFrame`), the last mounted on a tie; each Head holds one stable registration updated in place and removed on unmount; existing shell tags are taken over and restored; `mount` provides the sink for its container's document. Invalid tags/attributes go through `checkTag`/`checkAttr`, are skipped, and are reported to `onError`. Tests: packages/ui/src/__tests__/head.test.ts (8 cases incl. conflicting titles, keyed list, invalid tags, shell restore, other document).

Note for .2/.3: `HeadSink` value is `HeadTarget { add(depth) => HeadEntry { set(tags), remove() } }`; with no sink provided (string/stream render today) Head does nothing.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK, 4 findings fixed; re-review SHIP)
## Evidence
- Commits: 7c6fd1cf60048ad993677e01c2b99655b1a61bd0, 84e6e46a6803e130275d7dbabce5f4990ed39df0, 1bd78a5a87f24de30ac27c5ed5bb22487c917dfc
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: