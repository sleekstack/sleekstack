## Conversation Evidence

- [user] "remove next/react and kit"
- [user] "migrate the dependant code away from these we are an alternate framework and do not provide react or next compatibility"
- [user] timing: "Spec it now, run after fn-54 and fn-53 merge"
- [user] docs site: "Rebuild on ui + Start" (its own spec; this one depends on it landing first)
- [user] React guests inside ui: "Keep guests for now"

## Goal & Context
<!-- scope: business -->

SleekStack is an alternate framework: `@sleekstack/ui` is the component model, `@sleekstack/router` and (soon) `@sleekstack/start` are the app layer, `@sleekstack/core` and `@sleekstack/runtime` are the DI and server runtime. It does not provide React or Next.js compatibility. The React adapter, the Next adapter, the kit facade and the islands package exist only for that compatibility, and other code still depends on them. [paraphrase]

This spec removes `@sleekstack/kit`, `@sleekstack/react`, `@sleekstack/next` and `@sleekstack/islands` and migrates everything that depends on them to `core`, `runtime`, `ui` and `router`, so no SleekStack package, app or document describes or relies on React or Next compatibility. React guests inside `ui` stay for now (a later spec decides them). [paraphrase]

## Architecture & Data Models
<!-- scope: technical -->

- Dependents found at planning time: the analyzer (reads kit graphs), the CLI (its agent-instructions command ships a file bundled with kit), devtools (a React panel over the react and query packages), the playground app (React app on the react package), the docs site (Next, fumadocs, and every adapter), and the kit-based analyzer fixtures. The bench app and the showcase use `core` and `ui` and need at most dependency cleanup. [inferred]
- Kit is a facade over core plus React and Next entry points; the showcase already runs on core, runtime and ui without it, so removal does not remove the module system, which lives in core. [inferred]
- The Next adapter owns the devtools route handler that serves runtime events to the panel. That feed needs a framework-agnostic home (a web-standard fetch handler) before the adapter goes, so the panel keeps working and `start` can mount it later. [inferred]
- The agent-instructions file that the CLI copies from kit has to move to a surviving package, with the same content rules (project vocabulary and verification rules, idempotent). [inferred]
- `@sleekstack/query`'s native layer and its ui entry stay; only users of the removed packages change. [paraphrase]
- React guests in `ui` and their analyzer rule are untouched. [paraphrase]

## API Contracts
<!-- scope: technical -->

- Removed public surfaces: everything exported by kit (including its React and Next entry points), the react adapter, the Next preset and its devtools entry, and the islands registry. No compatibility shim or deprecated re-export is kept. [paraphrase]
- Unchanged public surfaces: core, runtime, ui, router, testing, query and their behavior. [paraphrase]
- The runtime-event feed for devtools is a web-standard `Request` to `Response` handler; it answers 404 in production as today. [inferred]

## Edge Cases & Constraints
<!-- scope: technical -->

- The workspace must install, build, typecheck and test from a clean checkout after the removal; no dangling workspace references. [paraphrase]
- The analyzer's closed `AnalyzeCode` union: a code only the kit graph raised is removed together with its table row; codes shared with plain-layer and core graphs stay with identical behavior. [paraphrase]
- The "one public name across kit entry points" rule (ADR 0019) and its test are deleted with kit. [paraphrase]
- Git-excluded `apps/sleek-codes` must not enter the lockfile. [inferred]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The four packages are gone from the workspace, and nothing in packages, apps, tests, fixtures or docs imports or names them as a dependency. Errors: a clean install, build, typecheck and test run from the repo root pass, with no workspace reference left dangling; the lockfile has no stray entries. [paraphrase]
- **R2:** Devtools is built on `ui` with no dependency on React packages or the removed adapters, and shows what it shows today (atoms, `uiTrace`, queries, runtime graph and events). The runtime-event feed is a framework-agnostic fetch handler. Errors: the feed answers 404 in production; the panel stays out of production client chunks as the existing bundle test checks. [paraphrase]
- **R3:** The analyzer no longer reads kit graphs; it reads core modules, plain Layers, runtime roots and ui trees. Errors: for every fixture that does not use kit, the check output is identical before and after (saved and diffed); fixtures that existed only for kit are removed; error-code docs and tables match the remaining codes. [paraphrase]
- **R4:** The CLI's `check` works on core, plain-Layer and ui apps, and its agent-instructions command copies the file from its new home, idempotently. Errors: when the file cannot be found the command exits with the existing error code and says which package to install. [paraphrase]
- **R5:** The playground app is ported to `ui` (or removed if it only demonstrated the React adapter, decided in planning); the bench app and the showcase carry no dependency on the removed packages. Errors: no error surface beyond R1. [inferred]
- **R6:** Documentation and records match: pages and snippets about the removed packages are deleted, the remaining guides use core, runtime, ui, router and start, generated API docs cover only existing packages, ADRs for the removed packages are marked superseded by one new ADR, CONTEXT.md drops the kit, React-adapter, Next and Island terms, and AGENTS.md's verify table and fixture graph check use only remaining fixtures. Errors: the docs site build and snippet typecheck pass. [paraphrase]
- **R7:** Core and runtime behave as before. Errors: their test suites pass unchanged and the non-kit fixture graphs are identical (R3's saved output). [paraphrase]

## Boundaries
<!-- scope: business -->

- The docs site rebuild on `ui` and `start` is its own spec and must land first; this spec only removes what it depended on once it no longer does. [user]
- React guests in `ui`, their analyzer rule and React as a peer dependency of `ui`, router, testing and query stay until a separate decision. [user]
- No compatibility shim, deprecated alias or migration codemod for kit, React or Next users. [paraphrase]
- No change to core, runtime, query's native layer, router or `start` behavior. [paraphrase]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

A framework that ships adapters for the thing it replaces sends mixed signals, carries their maintenance and size, and keeps the docs, analyzer and CLI describing two products. [paraphrase]

### Implementation Tradeoffs
<!-- scope: technical -->

Order matters: the docs site, devtools, analyzer and CLI move off the packages first and the packages are deleted last, so every step stays buildable. Rejected: keeping thin deprecated re-exports (the user asked for no compatibility), and deleting packages first and fixing dependents after (leaves master broken between PRs). [paraphrase]


## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/runtime... --filter=@sleekstack/devtools... --filter=@sleekstack/analyze --filter=sleekstack --filter=showcase --filter=docs
```

## Early proof point

Task fn-55-remove-kit-react-next-and-islands.4 validates the approach (the analyzer works without kit and non-kit fixture output is identical). If it fails, re-evaluate which kit concepts have no core equivalent before continuing with the removal.


## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | The four packages are gone from the workspace, and nothing in packages, apps, tests, fixtures or docs imports or names them as a dependency. Errors: a clean install, build, typecheck and test run from the repo root pass, with no workspace reference left dangling; the lockfile has no stray entries. | fn-55-remove-kit-react-next-and-islands.6 | — |
| R2 | Devtools is built on `ui` with no dependency on React packages or the removed adapters, and shows what it shows today (atoms, `uiTrace`, queries, runtime graph and events). The runtime-event feed is a framework-agnostic fetch handler. Errors: the feed answers 404 in production; the panel stays out of production client chunks as the existing bundle test checks. | fn-55-remove-kit-react-next-and-islands.1, fn-55-remove-kit-react-next-and-islands.2, fn-55-remove-kit-react-next-and-islands.3 | — |
| R3 | The analyzer no longer reads kit graphs; it reads core modules, plain Layers, runtime roots and ui trees. Errors: for every fixture that does not use kit, the check output is identical before and after (saved and diffed); fixtures that existed only for kit are removed; error-code docs and tables match the remaining codes. | fn-55-remove-kit-react-next-and-islands.4 | — |
| R4 | The CLI's `check` works on core, plain-Layer and ui apps, and its agent-instructions command copies the file from its new home, idempotently. Errors: when the file cannot be found the command exits with the existing error code and says which package to install. | fn-55-remove-kit-react-next-and-islands.5 | — |
| R5 | The playground app is ported to `ui` (or removed if it only demonstrated the React adapter, decided in planning); the bench app and the showcase carry no dependency on the removed packages. Errors: no error surface beyond R1. | fn-55-remove-kit-react-next-and-islands.5 | — |
| R6 | Documentation and records match: pages and snippets about the removed packages are deleted, the remaining guides use core, runtime, ui, router and start, generated API docs cover only existing packages, ADRs for the removed packages are marked superseded by one new ADR, CONTEXT.md drops the kit, React-adapter, Next and Island terms, and AGENTS.md's verify table and fixture graph check use only remaining fixtures. Errors: the docs site build and snippet typecheck pass. | fn-55-remove-kit-react-next-and-islands.7 | — |
| R7 | Core and runtime behave as before. Errors: their test suites pass unchanged and the non-kit fixture graphs are identical (R3's saved output). | fn-55-remove-kit-react-next-and-islands.4, fn-55-remove-kit-react-next-and-islands.6 | — |
