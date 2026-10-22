---
satisfies: [R3, R4, R6, R12]
---
# fn-69-server-auto-wiring.4 ui-vite: RPC File codegen (Tag, registry entry, implementation Layer, client, virtual:sleek/rpc)

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/**]

## Description
The early proof point: one written signature in a `*.rpc.ts` file produces the Tag, the registry entry, the implementation Layer and the browser client through the plugin (R3, R4, R6, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/index.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `rpc-files/`

### Approach
- Discover `*.rpc.ts` under the server directory (the `serverDir` option from the sibling spec); one Tag object per service, shared by every generated module (`virtual:sleek/rpc`, `virtual:sleek/server`, `virtual:sleek/server-registry`, `virtual:sleek/server-app`); showcase compares Tags by identity.
- Registry entries from the shared reader through `entriesCode` (`server-services.ts:92-115`); the implementation Layer calls the start builder (task 3) with the file's exports and its `wrap`, never re-implementing the split; the browser client uses `serverClients` (`start/client.ts:120-136`) and imports only client-safe modules.
- The declaration types each Tag by a mapped type over the RPC File's exports with `R` erased and `NetworkError | DecodeError` added (today it names a class by `import()` at `:118-135`); services and methods are sorted for a stable committed file.
- Dev: a `*.rpc.ts` add, remove, rename or edit regenerates and invalidates the new virtual modules; the watch predicate is separate from the server-only guard (the watcher returns early on server files today, `:236`).

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:63-284`
- `packages/start/src/client.ts:120-136`
- `packages/ui-vite/src/__tests__/server-services.test.ts:143-260`
- `apps/realworld/server/comments-api.server.ts` and `apps/realworld/src/modules/comments/application/contracts.ts` - the shape to reproduce

**Optional**:
- `.flow/memory/bug/integration/virtual-module-needs-a-declaration-and-2026-10-18.md`

## Acceptance
- [ ] a fixture RPC File with `delete`, a typed error class and a referenced Schema generates all four artefacts; the wire id is `<Service>.<method>`
- [ ] a TypeScript consumer typechecks `yield* Comments` against the written declaration
- [ ] the same Tag object is returned by every generated module
- [ ] dev: add, remove, rename and edit regenerate; an invalid file keeps the previous declaration and reports its path
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
