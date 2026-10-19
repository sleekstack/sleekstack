## Goal & Context
<!-- scope: business -->

`@sleekstack/router`'s `Link` is an anchor that cannot be styled or labeled: it accepts only `href`, `table`, `code`, `loaders`, `prefetch` and `children`, and drops everything else. A real app needs `class`, `id`, `aria-*`, `rel`, `target` and `data-*` on it. The RealWorld app (fn-61) used plain anchors instead, which also lost hover and focus prefetching. After this spec an app uses `Link` for every in-app link.

The analyzer half of the original idea is already done: `sleekstack check` resolves router `Link` (the analyzer's `libId` includes `router`; a probe in `apps/realworld` with `<Link href table>` reports no diagnostics), so the stale memory entry `sleekstack-check-cannot-read-router-Link` is corrected here and this spec only adds a regression fixture.

## Architecture & Data Models
<!-- scope: technical -->

- `LinkProps` extends the ui anchor attributes minus `href`, `children` and every event handler (`on*`), with `href` re-declared as a plain `string` (the typed `a.href` also allows an atom, but `Link` reads it with `new URL`). `class` / `className` stay one-of-never-both: a plain `Omit` over that union collapses it, so derive the type with a distributive omit or export a ready anchor-attributes type from `@sleekstack/ui`.
- The remaining attributes pass straight to the rendered `<a>`. `table`, `code`, `loaders` and `prefetch` never reach it. `key` and `ref` follow the component rules of `jsx` and are not forwarded as attributes.
- Event handlers are not accepted: `jsx()` does not merge handlers (one prop key is one handler), the prefetch closures are the `onMouseEnter` / `onFocus` of the anchor, and the analyzer does not inspect handler closures on a library component, so a caller handler's errors and requirements would go unchecked. `startRouter` already intercepts clicks by delegation, so a caller `onClick` is not needed for navigation.
- `target` and `download` already opt a link out of router click handling (`startRouter`); passing them through keeps that.

## API Contracts
<!-- scope: technical -->

`Link` keeps its call shape and current props. Added: the non-event anchor attributes. Unchanged: `match`, `prefetchLoader`, `Loaders`. If a ui type is exported for this, it is a new public name (one name, one meaning, ADR 0019); the fixture graph check must match before and after.

## Edge Cases & Constraints
<!-- scope: technical -->

- `prefetch={false}` renders the same attributes without the two prefetch handlers.
- A cross-origin or unmatched `href`: no prefetch, attributes still render.
- A `target="_blank"` or `download` link may still prefetch; it is a warm-up only (state this in the docs, do not special-case).
- Prefetch work stays lazy (`location` is read inside the handler), so server rendering is unaffected.
- A local component named `Link` is not treated as the router's (matched by declaration).
- Generated API docs (`apps/docs/content/docs/api/*.md`) are never hand-edited; run `generate:api` if the router API page exists.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `<Link href="/x" table={t} class="nav-link" aria-current="page" rel="noopener" data-x="1">` server-renders and hydrates with those attributes on the `<a>` and no `table`, `code`, `loaders` or `prefetch` attribute. Errors: both `class` and `className` is a type error; a missing `href` or `table` stays a type error; an atom `href`, or any `on*` prop, is a type error.
- **R2:** Hover and focus still prefetch the route's code and loaders with the attributes present. Errors: a failing prefetch stays silent; `prefetch={false}` attaches neither handler but keeps the attributes; a cross-origin or unmatched `href` prefetches nothing.
- **R3:** `sleekstack check` reports no diagnostics for a tree that renders `Link` with the new attributes (a regression fixture beside `ui-router-roots`), and a local component named `Link` stays unresolved or app-checked. Errors: an unresolvable component still fails closed.
- **R4:** `apps/realworld` uses `Link` (with `class`) for its in-app links (nav, tabs, tags, article and profile links, form footers), keeps external links as anchors, and its tests and `check` pass. Errors: the shared header has no route's loaders, so its links prefetch code only or nothing; prefetch is on wherever a route's loaders are known.

## Early proof point
<!-- scope: technical -->

Task fn-62-router-link-takes-anchor-attributes-and.1 validates the core approach (anchor attributes pass through with prefetch intact and the analyzer stays clean). If it fails, re-evaluate handler support before fn-62-router-link-takes-anchor-attributes-and.2.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld`

## Boundaries
<!-- scope: business -->

Out of scope: an active-link state (`aria-current` is set by the caller), caller event handlers on `Link`, a `Link` for non-anchor elements, changes to `startRouter` navigation, search-param routing, any analyzer source change (add one only if the fixture fails).

## Decision Context
<!-- scope: both -->

Raised by fn-61 (RealWorld app). Rejected composing caller handlers with the prefetch handlers: it needs a rule for functions, Effects and resumable handlers, and the analyzer would drop their errors. Rejected a name-based analyzer special case; matching is by declaration.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `<Link href="/x" table={t} class="nav-link" aria-current="page" rel="noopener" data-x="1">` server-renders and hydrates with those attributes on the `<a>` and no `table`, `code`, `loaders` or `prefetch` attribute. Errors: both `class` and `className` is a type error; a missing `href` or `table` stays a type error; an atom `href`, or any `on*` prop, is a type error. | fn-62-router-link-takes-anchor-attributes-and.1 | — |
| R2 | Hover and focus still prefetch the route's code and loaders with the attributes present. Errors: a failing prefetch stays silent; `prefetch={false}` attaches neither handler but keeps the attributes; a cross-origin or unmatched `href` prefetches nothing. | fn-62-router-link-takes-anchor-attributes-and.1 | — |
| R3 | `sleekstack check` reports no diagnostics for a tree that renders `Link` with the new attributes (a regression fixture beside `ui-router-roots`), and a local component named `Link` stays unresolved or app-checked. Errors: an unresolvable component still fails closed. | fn-62-router-link-takes-anchor-attributes-and.1 | — |
| R4 | `apps/realworld` uses `Link` (with `class`) for its in-app links (nav, tabs, tags, article and profile links, form footers), keeps external links as anchors, and its tests and `check` pass. Errors: the shared header has no route's loaders, so its links prefetch code only or nothing; prefetch is on wherever a route's loaders are known. | fn-62-router-link-takes-anchor-attributes-and.2 | — |
