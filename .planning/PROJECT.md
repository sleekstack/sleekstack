# SleekStack

## What This Is

A runtime architecture layer that adds structured dependency management, React-scoped service graphs, and request-scoped server environments on top of React, Next.js, and Effect TS.

SleekStack is not a framework. It is the glue between Effect's power and React's component model — a middle path where users write Effect-native primitives (`Context.Tag`, `Layer`, `Effect.gen`) and SleekStack owns the runtime infrastructure (`Runtime`, `Scope`, `Fiber`) they never touch.

## Core Value

**ONE thing that must work:** `useService(Tag)` resolves a service from the nearest `LayerProvider`, suspending on first acquisition and returning synchronously from cache thereafter — with deterministic cleanup on unmount.

## What We're Building

### Phase 1 — @sleekstack/core + @sleekstack/react (MVP)

The foundational runtime: `module()`, `LayerProvider`, and `useService`. This is the proof that React + Effect service graphs work correctly.

- `module({ name, layers, imports?, exports? })` — named layer group with dependency/export contracts
- `<LayerProvider provide={[LayerA, ModuleB]}>` — React scope owner; nested providers inherit parent scope
- `useService(Tag)` — sync-fast-path hook with Suspense on first resolution
- Shadowing: put a replacement in `provide` to override a transitive dep (no separate overrides prop)
- Circular import detection at `module()` definition time
- Missing service → clear runtime error: `"Service 'X' is not provided. Add XLayer to a LayerProvider above <Component>."`

### Phase 2 — @sleekstack/next

Server-side integration for Next.js App Router:
- `configureRuntime({ provide: [...] })` — global root layer in `instrumentation.ts`
- `action(function* () { const db = yield* Database })` — server action with request scope
- `query(function* () { ... })` — server read with request scope
- Per-action overrides: `action({ provide: [MockDbLayer] }, function* () { ... })`

### Phase 3 — @sleekstack/devtools (potential killer feature)

Graph visualization, dependency explorer, lifecycle tracing, Suspense waterfalls, resource ownership maps.

## Architecture Decisions (Locked)

See `docs/adr/` for full rationale. Summary:

| Decision | Choice | ADR |
|---|---|---|
| Effect coupling | Middle-path: expose Tag/Layer/Effect, hide Runtime/Scope/Fiber | 0001 |
| Module scope isolation | Type-level only (best-effort, not runtime-enforced) | 0002 |
| Override mechanism | Shadowing via `provide` ordering — no separate overrides prop | 0003 |

## What We're NOT Building

- A React replacement
- A Next.js replacement  
- A custom effect runtime
- `@sleekstack/testing` (deferred — shadowing covers 80% of testing needs)
- Airtight type-level module enforcement (TypeScript limits make it impractical)

## Target Users

TypeScript developers building full-stack React/Next.js applications who want structured concurrency, deterministic resource cleanup, and testable service graphs — without OOP containers, decorators, or runtime reflection.

## Technical Stack

- TypeScript (strict)
- Effect TS — service graphs, structured concurrency, resource scopes
- React 18+ — concurrent rendering, Suspense
- Next.js 14+ App Router — RSC, server actions
- pnpm workspaces + Turborepo — monorepo
- Vitest — testing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Middle-path Effect coupling | Full abstraction caps power users; full exposure overwhelms beginners | Locked |
| `provide` prop name | More explicit than `layers`, avoids hook naming confusion | Locked |
| `module()` requires `name` | Devtools need stable identifiers; Tags provide layer names for free | Locked |
| Next.js as separate world | Client (LayerProvider) and server (action/query) stay cleanly separate | Locked |
| Circular dep detection at definition time | Earliest possible failure, most actionable error | Locked |

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] `module()` with `name`, `layers`, `imports`, `exports` fields
- [ ] Circular import detection at `module()` definition time with cycle trace
- [ ] `LayerProvider` with `provide` prop accepting layers and modules
- [ ] Nested `LayerProvider` inherits parent scope
- [ ] `useService(Tag)` with sync-fast-path and Suspense on first resolution
- [ ] Shadowing: later entry in `provide` supersedes earlier transitive dep
- [ ] Missing service → descriptive runtime error with service name and fix hint
- [ ] Effect `Runtime` and `Scope` hidden from users; `Tag`, `Layer`, `Effect` exposed
- [ ] `@sleekstack/next`: `configureRuntime()`, `action()`, `query()` with request scope

### Out of Scope

- `@sleekstack/testing` — deferred; shadowing covers primary testing use case
- Airtight type-level module enforcement — TypeScript inference limits make it impractical; best-effort
- Custom effect runtime — Effect TS already solves this
- Decorators, reflection, mutable DI containers — explicitly anti-pattern for this project

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-06-20 after initialization*
