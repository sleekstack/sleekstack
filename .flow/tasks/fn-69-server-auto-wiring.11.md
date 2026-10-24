# fn-69-server-auto-wiring.11 docs, ADR status, README and llms.md finalization for auto-wiring

Touches: [apps/docs/content/docs/**, apps/docs/snippets/**, apps/docs/test/**, packages/start/README.md, packages/ui-vite/README.md, packages/analyze/README.md, apps/realworld/README.md, apps/showcase/README.md, docs/adr/**, CONTEXT.md, packages/cli/llms.md, packages/start/src/server-app.ts]

## Description
Finish the documentation and status work of ADR 0054 once the code exists.

**Size:** M
**Files:** `apps/docs/content/docs/server-services.mdx`, `vite.mdx`, `errors.mdx`, `testing.mdx`, `meta.json`, a new RPC and auto-wiring guide with type-checked snippets under `apps/docs/snippets/**`, the READMEs of start, ui-vite, analyze, realworld and showcase, `docs/adr/README.md`, `docs/adr/0054-server-auto-wiring.md`, `docs/adr/0053-file-routed-controllers.md`, `CONTEXT.md`, `packages/cli/llms.md`

### Approach
- Rewrite the "nothing is auto-discovered" statement (`server-services.mdx:21`) and document Layer Files, the Server Root, RPC Files, the RPC Manifest, `virtual:sleek/rpc` and `virtual:sleek/server-app`, with snippets that typecheck (a snippet using a virtual module needs a committed declaration beside it; the guides test forbids inline code fences). <!-- Updated by plan-sync: fn-68-file-routed-controllers.12. `server-services.mdx:21` now reads "Unlike a Controller, an implementation is not discovered: the server entry passes it", and `:39` says the plugin "serves three virtual modules" (`virtual:sleek/rpc` makes four; `:43` already has `virtual:sleek/server-app`). The Controllers guide `apps/docs/content/docs/controllers.mdx` exists and is in `meta.json` after `server-services`; extend it or add the new guide beside it. Its `:83` ("A method's `R` comes from `start({ layer })`, a `wrap`, or the request services"), the comment of `apps/docs/snippets/controllers/server/app.ts` ("`layer` provides what their methods need") and the status line of ADR 0053 ("until it is built, a Controller's services come from `start({ layer })` or a `wrap`, not from found Layers") all need Layer Files added. The docs snippets share one TS program (`apps/docs/tsconfig.json` includes every `.ts` and `.tsx`), so each virtual module is declared once: `snippets/server-services/server.gen.d.ts` declares `virtual:sleek/server` and `virtual:sleek/server-registry`, and `snippets/controllers/src/server.gen.d.ts` only the `virtual:sleek/server-app` section. Declare `virtual:sleek/rpc` in one of them, not in a new file; `guides.test.ts` also requires every snippet file to be included by a guide. `apps/realworld/README.md` "Two server surfaces" still says the contracts are in `application/contracts.ts` and implemented with `implement` in `server/*.server.ts`; fn-68-file-routed-controllers.11 updated only its REST bullet -->
- Bring the ADRs in line with what shipped: Directory Defaults `wrap` is Controllers only while `bodyLimit` and `origins` also reach RPC; `origins` only adds; the shape code `ServerFileShape`; the test-exclusion list; the PascalCase rule. Flip ADR 0054 to `Accepted` with `Built in spec fn-69` and update the README row; check CONTEXT.md terms against the final behaviour. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1, .11 and .12. Stale in ADR 0054 now: the Context sentence that `server/app.ts` "names `rest` as middleware" (fn-68 deleted `rest.ts` and the middleware entry); "`start()` takes no arguments" in the Decision, the README row and its title, since `start` still takes options, all optional, and `router` is optional; the Consequence that `start()` reaching a virtual module from an externalizable package is unverified (fn-68-file-routed-controllers.1 settled it: zero-argument `start()` works in `ssrLoadModule`, Vitest and `vite build --ssr` through the `./discovered` stand-in that the plugin redirects, the fallback was not needed, and an externalized start cannot load anyway because its dist is bundler-only); and "realworld moves `rest.ts` to Controllers" in the Proof (done by fn-68, this spec moves the three Server Services). ADR 0053's status line says that until ADR 0054 is built a Controller's services come from `start({ layer })` or a `wrap` -->
- Document that `sleekstack check` counts a Tag declared by `virtual:sleek/rpc` (an RPC File or a Manifest entry) as provided for `start({ services })`, since the discovered app supplies its implementation; a hand-written Server Service with no implementation Layer is still reported (fixture `server-service-start-generated` in `packages/analyze/src/__tests__`). `apps/realworld/README.md` after fn-69.9: the infra is Layer Files (`server/*.layer.ts`), comments is an RPC File (`server/comments-api.rpc.ts`), and `SESSION`, `asViewer`, `secure` and `signIn` live in `server/session.ts`; fn-69.10 finishes identity and articles, so write the README once after it. <!-- Added by plan-sync: fn-69-server-auto-wiring.9 --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.10 finished it: identity and articles are RPC Files (`server/identity-api.rpc.ts`, `articles-api.rpc.ts`, each `export const wrap: RpcWrap = asViewer`), `application/contracts.ts` and the `implement` calls are gone from all three modules, and `server/app.ts` is `start({ router: pages, services })` with no `layer` (`AppLive`, which is `Layer.empty`, stays only for `main.tsx`). Write `apps/realworld/README.md` "Two server surfaces" (`:27`) from that state: pages and loaders `yield* <Tag>` with the Tag from `virtual:sleek/rpc`. The identity file-level `wrap` also covers register, login and logout. `start`'s `layer` option rejects `Layer.empty` (TS2322, `packages/start/src/start.ts:29-32`); no remaining task's Touches covers that file (this task's `packages/start/src/server-app.ts` is a different one), so document that an app with no explicit Tag to provide omits `layer`, and leave the typing fix to a follow-up outside this spec -->
- Document that `LayerFileServices` in the generated declaration is keyed by Layer File, and that an app without a `tsconfig.json` skips the Layer File pass. <!-- Added by plan-sync: fn-69-server-auto-wiring.6 -->
- Confirm `cli/llms.md` is under its cap after all new rows; run the docs tests and build with `--concurrency=1`. <!-- Updated by plan-sync: fn-68-file-routed-controllers.4: `llms.md` is 6191 of 8192 bytes after fn-69.1's three rows, so the three RPC rows still fit; `errors.mdx` already has a Server file errors section (`#server-file-errors`) for the Layer File codes, so only the RPC section is new; regenerate with `UPDATE_LLMS=1 vitest run llms` --> <!-- Updated by plan-sync: fn-69-server-auto-wiring.2 already added the three RPC rows to `llms.md` (7082 of 8192 bytes, not 6191) and the "RPC errors" section of `errors.mdx`, so neither is new here; about 1100 bytes remain for any further row -->



### Investigation targets
**Required** (read before coding):
- `apps/docs/content/docs/server-services.mdx`, `apps/docs/test/examples.test.ts`, `guides.test.ts`, `api-coverage.test.ts`
- `docs/adr/0053-file-routed-controllers.md`, `docs/adr/0054-server-auto-wiring.md`

**Optional**:
- `apps/docs/snippets/server-services/server.gen.d.ts`

## Acceptance
- [ ] the docs describe every new file kind and virtual module with type-checked snippets
- [ ] ADR 0054 is Accepted with its spec id; ADR 0053 and CONTEXT.md match the shipped behaviour
- [ ] `cli/llms.md` is under its cap
- [ ] `pnpm turbo run test typecheck build --filter=docs --concurrency=1` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
