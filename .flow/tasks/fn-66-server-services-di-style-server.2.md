---
satisfies: [R1, R3, R6]
---
# fn-66-server-services-di-style-server.2 start/client: `serverClient` Layers for the browser

## Description
The browser half: turn one registry entry into a Layer providing its Tag, each method a `client` stub, and merge entries into the single Layer the generated `virtual:sleek/server` module will return. Built on `client` unchanged (formData decode, `NetworkError`, `decodeResult`), so the wire is shared with serverFn.

**Size:** S
**Files:** packages/start/src/client.ts, packages/start/src/__tests__/client.test.ts, packages/start/src/__tests__/client.test-d.ts
**Touches:** [packages/start/src/client.ts, packages/start/src/__tests__/client*]

### Approach
- `serverClient(entry)`: `Layer.succeed(entry.tag, { <method>: (input) => client({ id: '<tag id>.<method>', ...schemas })(input) })`. A zero-parameter method calls the stub with `undefined` (the empty-body path for `Schema.Void`).
- `serverClients(entries)`: `Layer.mergeAll` of the above, typed as `Layer<Tags>` so a page's requirement is met by the generated Layer and `sleekstack check` sees it.
- Export both from the `./client` subpath only.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/client.ts:75-110` — the `client` body to reuse
- `packages/start/src/service.ts` (task 1) — the entry type
- `packages/start/src/__tests__/client.test.ts` — how `fetch` is faked

### Key context
Nothing server-side may be imported here; the existing `client` test asserts what the chunk holds only through the showcase, so keep the import list of `client.ts` unchanged apart from `service.ts`.

## Acceptance
- [ ] Test (fake `fetch`): a method call posts the encoded input to `/_sleek/fn/<Tag>.<method>`; a Failure envelope decodes into the declared error class via `taggedError`; a rejected `fetch` is `NetworkError`; a zero-argument method posts an empty body.
- [ ] Test: a success body that does not match the success Schema is a `DecodeError`.
- [ ] Type test: `serverClients([...])` is a `Layer` providing exactly the entries' Tags.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` passes.

## Done summary
Added `serverClient(entry)` and `serverClients(entries)` to `@sleekstack/start/client` (packages/start/src/client.ts). `serverClient(entry)` is a `Layer.succeed(entry.tag, ...)` with one `client` stub per method at `<Tag id>.<method>`, so the wire is the one serverFn uses. `serverClients(entries)` merges those into one `Layer<Tags>`, folding from `Layer.empty` so an empty list is valid.

- Tests: packages/start/src/__tests__/client.test.ts `serverClient` (posts the encoded input to /_sleek/fn/Profiles.rename, a zero-argument method sends an empty body, a Failure envelope becomes a NameTaken instance, a rejected fetch is NetworkError, a bad success body is DecodeError). packages/start/src/__tests__/client.test-d.ts (`serverClients` gives exactly `Layer<Profiles | Items>`; a Layer missing a Tag is a type error).
- Note for task .1 owners: `taggedError` decode passes `_tag` into the constructor, so the decoded instance's key order differs from `new NameTaken(...)` and `toEqual` fails. The test uses `toMatchObject` plus `instanceof`. Fixing it means stripping `_tag` before `new Class(...)` in service.ts, which is outside this task's Touches.
- The stubs' `Redirect | NotFound` error is cast into the Tag's type. At runtime they still arrive if the server sends them.

stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium
## Evidence
- Commits: fd13d17e311c048b639678aa1c5f40e7a2cc5c19
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start..., baseline: none (not run pre-edit; post-change gate green)
- PRs: