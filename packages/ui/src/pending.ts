import { Cause, Effect, Exit, Fiber, Scope } from 'effect'
import { type Child, Fragment } from './jsx-runtime'
import type { Node } from './node'
import { Collector, Frame, makeFrame, owned, pendingOf, RenderScope, type RunFrame, scopedRun, type Slots, useLocal } from './reactive'

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

const closeScope = (scope: Scope.CloseableScope) => Effect.runFork(Scope.close(scope, Exit.void))

/**
 * `<Pending fallback={…}>…</Pending>`: renders `fallback` until `children` resolve, then the content in the same place.
 * Content runs in a fiber of its own, in a scope and frame the Pending owns; a re-run keeps resolved content on screen
 * until the replacement resolves.
 */
export const Pending = (props: { fallback: Child; children?: Child }): Effect.Effect<Node, never, never> =>
  Effect.flatMap(RenderScope, (rs) =>
    // No `RenderScope` (renderToString): content runs inline and is awaited; the fallback is never emitted.
    rs ? live(props) : Effect.map(Fragment({ children: props.children }), (n) => (pendingOf.set(n, { fallback: props.fallback, content: props.children }), n)),
  ) as Effect.Effect<Node, never, never>

const live = (props: { fallback: Child; children?: Child }) =>
  Effect.flatMap(useLocal<Content | undefined>(undefined), ([content, set]) =>
    Effect.flatMap(Frame, (frame) => {
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
        const run = Fragment({ children: props.children }).pipe(
          Effect.provideService(Collector, undefined),
          Effect.provideService(Frame, cframe),
          Effect.provideService(RenderScope, scope),
          Effect.onExit((exit) =>
            Effect.sync(() => {
              fork.done = true
              const latest = forks.get(slots) === fork
              if (latest && Exit.isSuccess(exit)) return set({ node: owned(exit.value, scope), frame: cframe, props })
              closeScope(scope)
              if (latest && Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) set((c) => ({ ...c, props, cause: exit.cause }))
            }),
          ),
        )
        return Effect.flatMap(Effect.forkDaemon(run), (fiber) =>
          Effect.flatMap(Scope.addFinalizer(scope, Fiber.interruptFork(fiber)), () => emit(content, info, props)),
        )
      }
      // The slot-set re-run of a failed fork raises its cause through the instance's handlers.
      if (content?.cause && content.props === props) return Effect.failCause(content.cause)
      return emit(content, info, props)
    }),
  )

// Resolved content (current or previous) stays on screen; only a Pending with none yet shows the fallback.
const emit = (content: Content | undefined, info: { fallback: Child; content: Child }, props: { fallback: Child }): Effect.Effect<Node, any, any> =>
  content?.node
    ? Effect.sync(() => (pendingOf.set(content.node!, { ...info, frame: content.frame }), content.node!))
    : Effect.map(scopedRun(Fragment({ children: props.fallback })), (n) => (pendingOf.set(n, info), n))
