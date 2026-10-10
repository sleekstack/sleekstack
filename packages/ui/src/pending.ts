import { Cause, Context, Effect, Exit, Fiber, Scope } from 'effect'
import { type Child, Fragment } from './jsx-runtime'
import type { Node } from './node'
import {
  Collector,
  Frame,
  makeFrame,
  owned,
  pendingOf,
  Reads,
  RenderScope,
  type RunFrame,
  scopedRun,
  type Slots,
  Transition,
  useLocal,
  counted,
} from './reactive'

/**
 * Resolved content: moved into the slot by the content fiber, emitted as is by later runs; its node owns the content scope.
 * `cause` is a failed fork, raised once by the slot-set re-run (nearest `Boundary`, else `onError`); the previous content stays.
 */
interface Content {
  readonly node?: Node
  readonly frame?: RunFrame
  readonly props: object
  readonly cause?: Cause.Cause<unknown>
}

// The latest fork per content slot tree; an older or disposed fork writes nothing.
interface Fork {
  readonly props: object
  readonly scope: Scope.CloseableScope
  done: boolean
}
const forks = new WeakMap<Slots, Fork>()

// Content slots live under the Pending's own slots, so they survive its re-runs and go when it is disposed.
const contentSlots = (f: RunFrame): Slots => {
  ;(f.seen ??= new Set()).add('content')
  const kids = (f.owner.kids ??= new Map())
  let s = kids.get('content')
  if (!s) {
    kids.set('content', (s = { atoms: [], releases: [], done: false }))
    ;(f.pending ??= []).push(['content', s])
  }
  return s
}

/**
 * On during `hydrateMount`'s first run: a Pending resolves its content inline (the server awaited it), no fallback.
 * A mutable cell, not a value: re-runs capture their context, and must see it off once the adopt is done.
 */
export class Hydrating extends Context.Reference<Hydrating>()('@sleekstack/ui/Hydrating', {
  defaultValue: (): HydratingCell => ({ on: false }),
}) {}

/**
 * Hydration of a stream: `late` maps a boundary path to the id of a placeholder still on screen; such a Pending emits
 * its fallback and registers in `deferred`, keyed by the fallback node, so `hydrateMount` adopts the content when the
 * chunk lands. `counts` numbers Pendings per parent path in run order, as the stream numbers them in serialize order.
 */
export interface HydratingCell {
  on: boolean
  late?: Map<string, string>
  counts?: Map<string, number>
  deferred?: WeakMap<Node, Late>
}
/** A boundary whose chunk had not arrived: `land` runs `before` (seeding the chunk's state), then the content, hydrating; no node when superseded. */
export interface Late {
  readonly id: string
  readonly land: (before: Effect.Effect<void, never, any>) => Promise<Exit.Exit<Node | undefined, unknown>>
}
// The path of the enclosing Pending's content, `0.1`-style; '' at the top.
class BoundaryPath extends Context.Reference<BoundaryPath>()('@sleekstack/ui/BoundaryPath', {
  defaultValue: () => '',
}) {}

const numbered = (counts: Map<string, number>, parent: string): string => {
  const n = counts.get(parent) ?? 0
  counts.set(parent, n + 1)
  return parent ? `${parent}.${n}` : String(n)
}

const closeScope = (scope: Scope.CloseableScope) => Effect.runFork(Scope.close(scope, Exit.void))

/**
 * `<Pending fallback={…}>…</Pending>`: renders `fallback` until `children` resolve, then the content in the same place.
 * Content runs in a fiber of its own, in a scope and frame the Pending owns; a re-run keeps resolved content on screen
 * until the replacement resolves.
 */
export const Pending = (props: { fallback: Child; children?: Child }): Effect.Effect<Node, never, never> =>
  Effect.flatMap(RenderScope, (rs) =>
    // No `RenderScope` (renderToString): content runs inline and is awaited; the fallback is never emitted.
    // Hydrating: the server emitted no instance host for a Pending, so its reads are kept off the instance (a scratch
    // collector); the content slot is still allocated, so later re-runs line up.
    rs
      ? Effect.flatMap(Hydrating, (h) =>
          h.on ? Effect.provideService(live(props), Collector, new Reads(props)) : live(props),
        )
      : Effect.map(
          Fragment({ children: props.children }),
          (n) => (pendingOf.set(n, { fallback: props.fallback, content: props.children }), n),
        ),
  ) as Effect.Effect<Node, never, never>

const live = (props: { fallback: Child; children?: Child }) =>
  Effect.flatMap(useLocal<Content | undefined>(undefined), ([content, set]) =>
    Effect.flatMap(
      Effect.all([Frame, Hydrating, BoundaryPath, Transition, Effect.context<never>()]),
      ([frame, hydrating, parent, transition, ctx]) => {
        const f = frame!
        const slots = contentSlots(f)
        const info = { fallback: props.fallback, content: props.children }
        // Discriminator: the instance's own `rerun` (fired by the slot set) passes the same props object, so stored content
        // for these props is emitted without forking; a fresh run (first mount, parent re-run) has new props and forks.
        if (content?.props !== props && forks.get(slots)?.props !== props) {
          // Supersede: latest wins, so an unfinished older fork is interrupted with its scope.
          const prev = forks.get(slots)
          if (prev && !prev.done) closeScope(prev.scope)
          const scope = Effect.runSync(Scope.make())
          const fork: Fork = { props, scope, done: false }
          forks.set(slots, fork)
          // Dispose (unmount, key change) closes the scope, interrupting the fiber, and retires the fork in the same tick.
          // ponytail: one closer per fork until the Pending is disposed; prune on commit if forks get frequent.
          slots.releases.push(() => (forks.get(slots) === fork && forks.delete(slots), closeScope(scope)))
          const cframe = makeFrame(slots, `${f.id}/content`)
          let resolved: Content | undefined
          const path = hydrating.on && hydrating.counts ? numbered(hydrating.counts, parent) : ''
          const run = Fragment({ children: props.children }).pipe(
            Effect.provideService(Collector, undefined),
            Effect.provideService(Frame, cframe),
            Effect.provideService(RenderScope, scope),
            Effect.provideService(BoundaryPath, path),
            Effect.onExit((exit) =>
              Effect.sync(() => {
                fork.done = true
                const latest = forks.get(slots) === fork
                if (latest && Exit.isSuccess(exit))
                  return set((resolved = { node: owned(exit.value, scope), frame: cframe, props }))
                closeScope(scope)
                if (latest && Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause))
                  set((c) => ({ ...c, props, cause: exit.cause }))
              }),
            ),
          )
          // Hydrating a late boundary: the fallback is on screen; the content runs when its chunk lands, hydrating again.
          const id = hydrating.on ? hydrating.late?.get(path) : undefined
          if (id !== undefined)
            return Effect.map(emit(undefined, info, props), (n) => {
              const land = (before: Effect.Effect<void, never, any>) => {
                const cell = { ...hydrating, on: true }
                const go = Effect.zipRight(before, run).pipe(
                  Effect.provideService(Hydrating, cell),
                  Effect.provide(ctx),
                ) as Effect.Effect<unknown>
                return Effect.runPromise(Effect.exit(go)).then(
                  (exit) => ((cell.on = false), Exit.map(exit, () => resolved?.node)),
                )
              }
              hydrating.deferred!.set(n, { id, land })
              return n
            })
          // Hydrating: the server markup holds the resolved content, so it is awaited here and emitted on the first run.
          if (hydrating.on)
            return Effect.flatMap(Effect.exit(run), (exit) =>
              Exit.isFailure(exit) ? Effect.failCause(exit.cause) : emit(resolved, info, props),
            )
          // A transition re-run with no content to keep awaits the content inline, so the previous DOM stays until it
          // resolves; a failure shows the fallback and the slot-set re-run raises it, as for a fork.
          if (transition && !content?.node)
            return Effect.flatMap(Effect.exit(run), () => emit(resolved ?? content, info, props))
          return Effect.flatMap(Effect.map(Effect.forkDaemon(run), counted), (fiber) =>
            Effect.flatMap(Scope.addFinalizer(scope, Fiber.interruptFork(fiber)), () => emit(content, info, props)),
          )
        }
        // The slot-set re-run of a failed fork raises its cause through the instance's handlers.
        if (content?.cause && content.props === props) return Effect.failCause(content.cause)
        return emit(content, info, props)
      },
    ),
  )

// Resolved content (current or previous) stays on screen; only a Pending with none yet shows the fallback.
const emit = (
  content: Content | undefined,
  info: { fallback: Child; content: Child },
  props: { fallback: Child },
): Effect.Effect<Node, any, any> =>
  content?.node
    ? Effect.sync(() => (pendingOf.set(content.node!, { ...info, frame: content.frame }), content.node!))
    : Effect.map(scopedRun(Fragment({ children: props.fallback })), (n) => (pendingOf.set(n, info), n))
