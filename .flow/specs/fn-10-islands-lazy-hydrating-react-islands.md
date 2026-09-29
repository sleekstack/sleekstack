## Goal & Context
<!-- scope: business -->

A Qwik-style loading model for real React: the page is server-rendered, and each interactive **Island** downloads its code and hydrates only when needed (on interaction, when visible, when idle, or on load). Islands are ordinary React components, so the React ecosystem keeps working inside them. SleekStack's kit supplies the service layer: an Island uses `useService` unchanged, and Effect services are shared across the Islands on a page.

Not resumability. React must re-run a component to attach state, so a hydrated Island renders once. The gain is that a non-interacted Island costs no download and no JS execution beyond a ~1 KB wrapper. Qwik-style resumability (serialised closures, no hydration) is an explicit non-goal because it cannot run arbitrary React libraries (decided with the user, 2026-09-29).

## Architecture & Data Models
<!-- scope: technical -->

- **Package** `@sleekstack/islands`, peer deps `react` and `@sleekstack/kit`. Next 15 App Router first; the wrapper has no Next imports.
- **Registry**: a `'use client'` module the app owns calls `defineIslands(map, opts?)` with `map` of name to `() => import(...)`, and exports a typed `<Island>`. Names are strings, so a Server Component can render it (functions cannot cross the RSC boundary). Each `import()` is its own chunk.
- **Dormant DOM**: the wrapper always renders one container element with a `data-island` attribute. On the server its child is the real component behind `React.lazy` + Suspense, inside the container. On the client the first render returns the same container with an empty `dangerouslySetInnerHTML` and `suppressHydrationWarning`, so React keeps the server DOM and attaches nothing. The wrapper's props to that element never change after the first render, so a wrapper re-render never rewrites `innerHTML`. On trigger the wrapper imports the chunk and calls `hydrateRoot` on the container (the Island becomes its own React root). A module-level `WeakMap<Element, Root>` keeps this at most once per container across StrictMode double effects and remounts on the same node.
- **Triggers**: `load`; `idle` (`requestIdleCallback`, `setTimeout` fallback); `visible` (IntersectionObserver with `rootMargin` option, re-armed when a hidden container becomes shown); `interaction` (first of `pointerdown`, `touchstart`, `focusin`, `keydown`, `click`, captured on the container; hydration starts on the earliest of these).
- **Replay** (custom; React only replays events for roots it is already hydrating, so an event before `hydrateRoot` is lost): only `click` is replayed, by re-dispatching a clone on the original target after hydration. It is skipped when the native default already ran and would run again: links, checkbox and radio inputs, labels, submit buttons and `summary`. All other events (pointer, key, focus) only start hydration. Events arriving while the chunk loads: only the first click is kept.
- **Effect handoff**: separate roots do not share React context, so the app scope lives outside React. `defineIslands(map, { provide })` takes the **app-scope** entries. A per-page app scope is created lazily on the first Island activation, is reference-counted, and closes when the last Island root unmounts (it is rebuilt on the next activation). Each `<Island provide={[...]}>` adds **component-scope** entries for that instance only. This needs one additive seam in `@sleekstack/react`: `LayerProvider` accepts an externally owned app scope that it does not close. Everything else in kit and core stays unchanged.
- **Atoms**: kit atoms live in the component scope, so they are per Island in v1. State shared across Islands goes through app-scope services (for example a service holding a `SubscriptionRef`). Sharing atoms across roots is a follow-up.
- **Lifecycle**: an Island wrapper's effect cleanup unmounts its root on a deferred tick (a synchronous unmount of another root during a commit warns). `onRecoverableError` logs with the Island name and keeps going. Each Island root has a boundary that logs a thrown error and renders nothing for that Island.

## API Contracts
<!-- scope: technical -->

```ts
// islands.client.ts
'use client'
export const Island = defineIslands({ counter: () => import('./Counter') }, { provide: [AppModule] })

// page.tsx (Server Component)
<Island name="counter" props={{ start: 3 }} hydrate="visible" provide={[CounterLayer]} />
```

`name` is `keyof map`, `props` is inferred from the component's props, `hydrate` is `'load' | 'idle' | 'visible' | 'interaction'` (default `'visible'`), `provide` is optional component-scope kit entries.

## Edge Cases & Constraints
<!-- scope: technical -->

- Props cross the RSC boundary through React's own serialiser (no extra check; unserialisable props already fail at render). `children` and server-rendered JSX props are not supported in v1.
- Components that call `useId` may mismatch on hydrate because a new root restarts the id tree; documented limitation, verified in the browser proof.
- The Island root does not inherit Next router context: `next/navigation` hooks and router-dependent behaviour are unsupported inside Islands in v1. Calling a kit `action()` must be verified to work.
- Fast Refresh / HMR of Island modules is not supported in v1.
- Chunk load failure: keep the dormant HTML, log once; the `interaction` trigger retries on the next event, other triggers do not retry.
- Two Islands with the same name on one page get separate roots and component scopes.
- Needs a real browser: jsdom has no streaming, IntersectionObserver or activation semantics, so DOM preservation and replay are proven with Playwright against `next build` output.
- No-JS and bots get complete server HTML.
- The wrapper must not import Island component code statically.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `<Island>` server-renders full HTML and does not hydrate until its trigger fires; after hydration the server DOM is preserved (no flash, no rewrite) even when the wrapper re-renders. Errors: unknown name is a type error at build and `IslandNotFound` in dev; chunk failure keeps the dormant HTML and logs; StrictMode and remount on the same node never call `hydrateRoot` twice.
- **R2:** The four triggers work; `visible` re-arms for initially hidden containers. Errors: no IntersectionObserver or `requestIdleCallback` falls back to `load` / `setTimeout`.
- **R3:** `interaction` replays the first click exactly once for non-native-activating targets, and never replays links, checkbox, radio, labels, submit buttons or `summary`. Errors: target detached after hydration drops the replay silently.
- **R4:** `useService` works inside an Island; all Islands on a page share one app-scope instance and have separate component scopes; the app scope closes when the last Island unmounts and rebuilds on the next activation. Errors: an app-scope build failure fails the Islands that need it and is retried on the next activation; a duplicate Tag between app and component entries raises the existing `DuplicateTag` behavior.
- **R5:** `@sleekstack/react` `LayerProvider` accepts an externally owned app scope without closing it; existing behavior is unchanged when the option is absent. Errors: no error surface beyond existing provider errors.
- **R6:** apps/showcase-kit has an Islands page; a bundle test proves Island component code is absent from the initial JS and present in a lazily loaded chunk; a Playwright test proves R1 and R3 in a real browser, including a kit `action()` call from an Island.
- **R7:** Documented: docs page, ADR 0010 (islands over resumability, next free number at write time), CONTEXT.md term **Island**, package README, CI package list. Errors: no error surface beyond docs tests.
- **R8:** `pnpm test` and `typecheck` are green across the monorepo.

## Quick commands
<!-- scope: technical -->

```bash
pnpm --filter @sleekstack/islands test
pnpm --filter @sleekstack/islands typecheck
```

## Early proof point
<!-- scope: technical -->

Task fn-10-islands-lazy-hydrating-react-islands.1 validates the core trick in a real browser: an empty `suppressHydrationWarning` container keeps the server DOM under React 19.2, survives a wrapper re-render, and `hydrateRoot` attaches cleanly. If it fails, re-evaluate the dormant-DOM design (fallback: render Islands as static HTML strings and hydrate from a separate client entry) before continuing with fn-10-islands-lazy-hydrating-react-islands.2+.

## Boundaries
<!-- scope: business -->

- No resumability, no serialised closures, no custom compiler, no React fork.
- No Pages Router, no non-React targets, no React Compiler support work.
- No changes to kit or core semantics; the one additive `LayerProvider` seam in `@sleekstack/react` is the only change outside the new package.
- No cross-Island atom sharing, no `children` or JSX props, no HMR, no Next router context in Islands (all v1 non-goals).
- No custom props validator; React's own serialisation errors are enough.

## Ordering
<!-- scope: technical -->

Task 1 (proof) first. Task 3 (react seam) is independent and can run in parallel with 1 and 2. Task 4 needs 1 and 3. Task 5 needs 2 and 4. Task 6 last. fn-9 also edits `apps/showcase-kit`, `CONTEXT.md` and the docs guides, so tasks 5 and 6 are rebased over fn-9 if it lands first; fn-9's `provide`-from-props path is checked at runtime only.

## Decision Context
<!-- scope: both -->

Chosen over true resumability because React-library compatibility was the hard requirement; hydration cost is cut by deferring it. Per-Island roots cost memory, accepted because shared state lives in the app scope instead of React context. Rejected as overkill: a compiler that extracts Islands automatically (explicit registry is smaller and works today); a custom props validator (React already errors).

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `<Island>` server-renders full HTML and does not hydrate until its trigger fires; after hydration the server DOM is preserved (no flash, no rewrite) even when the wrapper re-renders. Errors: unknown name is a type error at build and `IslandNotFound` in dev; chunk failure keeps the dormant HTML and logs; StrictMode and remount on the same node never call `hydrateRoot` twice. | fn-10-islands-lazy-hydrating-react-islands.1 | — |
| R2 | The four triggers work; `visible` re-arms for initially hidden containers. Errors: no IntersectionObserver or `requestIdleCallback` falls back to `load` / `setTimeout`. | fn-10-islands-lazy-hydrating-react-islands.1, fn-10-islands-lazy-hydrating-react-islands.2 | — |
| R3 | `interaction` replays the first click exactly once for non-native-activating targets, and never replays links, checkbox, radio, labels, submit buttons or `summary`. Errors: target detached after hydration drops the replay silently. | fn-10-islands-lazy-hydrating-react-islands.2 | — |
| R4 | `useService` works inside an Island; all Islands on a page share one app-scope instance and have separate component scopes; the app scope closes when the last Island unmounts and rebuilds on the next activation. Errors: an app-scope build failure fails the Islands that need it and is retried on the next activation; a duplicate Tag between app and component entries raises the existing `DuplicateTag` behavior. | fn-10-islands-lazy-hydrating-react-islands.4 | — |
| R5 | `@sleekstack/react` `LayerProvider` accepts an externally owned app scope without closing it; existing behavior is unchanged when the option is absent. Errors: no error surface beyond existing provider errors. | fn-10-islands-lazy-hydrating-react-islands.3 | — |
| R6 | apps/showcase-kit has an Islands page; a bundle test proves Island component code is absent from the initial JS and present in a lazily loaded chunk; a Playwright test proves R1 and R3 in a real browser, including a kit `action()` call from an Island. | fn-10-islands-lazy-hydrating-react-islands.5 | — |
| R7 | Documented: docs page, ADR 0010 (islands over resumability, next free number at write time), CONTEXT.md term **Island**, package README, CI package list. Errors: no error surface beyond docs tests. | fn-10-islands-lazy-hydrating-react-islands.6 | — |
| R8 | `pnpm test` and `typecheck` are green across the monorepo. | fn-10-islands-lazy-hydrating-react-islands.5 | — |

