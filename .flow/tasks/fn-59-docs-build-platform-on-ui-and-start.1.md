---
satisfies: [R3, R4]
---
# fn-59-docs-build-platform-on-ui-and-start.1 ui: void elements without closing tags, and Head core (collector, DOM patch, string output)

## Description
Two ui changes in the same renderer files. First the void-element fix: `renderToString` and `renderToStream` must write `br`, `hr`, `img`, `input`, `meta`, `link` and the rest of the HTML void list without a closing tag (today they write `<br></br>`). Then the core of `<Head>`: a per-render head collector, the DOM patch, and string output, per the open head-management spec (fn-33).

**Size:** M
**Files:** packages/ui/src/string.ts, stream.ts, dom.ts, index.ts, a new packages/ui/src/head.ts, tests in packages/ui/src/__tests__/ (string, stream, head), packages/ui/README.md export table
**Touches:** [packages/ui/src/**, packages/ui/README.md]

### Approach
- Void list: one constant shared by string and stream output; children given to a void element are reported as an error (TypeError, like invalid tags) rather than rendered.
- Head collector as a `Context.Reference` named `HeadSink` (fn-33: `Collector` already means two things). Entries dedupe by key (`title`, `meta[name]`, `meta[property]`, `link[rel]+href`); deepest component wins; entries are removed when the component unmounts; attributes go through the same `checkAttr` validation as elements.
- DOM mode patches `document.head` with a keyed patch; string mode exposes the head string through the render options so the caller puts it in the document shell.
- Equivalence pin: every existing ui test passes unchanged; the size test in the showcase is re-run and any growth recorded for the records task.

### Investigation targets
**Required**:
- `packages/ui/src/string.ts` (escape, checkTag, checkAttr, element writing)
- `packages/ui/src/stream.ts` (shell and chunk writing)
- `packages/ui/src/dom.ts` (element creation and patch, the `mount` root)
- `.flow/specs/fn-33-head-management-for-ui.md` (the head contract)
- `docs/adr/0023-*.md` (streaming protocol)
**Optional**:
- `packages/ui/src/__tests__/string.test.ts`, `stream.test.ts`, `apps/showcase/test/size.test.ts`

## Acceptance
- [ ] `renderToString` and `renderToStream` write every HTML void element with no closing tag; children on a void element raise the error; existing tests pass
- [ ] `<Head>` sets title, meta and link in the DOM and in `renderToString` output; nested overrides win; entries dedupe by key and are removed on unmount; an invalid tag or attribute is rejected like an element
- [ ] ui exports are listed in the README; `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
