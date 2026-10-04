import { Effect, Exit, Fiber, Scope } from 'effect'
import { type Child, Fragment } from './jsx-runtime'
import type { Node } from './node'
import { Collector, Frame, makeFrame, owned, pendingOf, RenderScope, type RunFrame, scopedRun, type Slots, useLocal } from './reactive'

/** Resolved content: moved into the slot by the content fiber, emitted as is by later runs; its node owns the content scope. */
interface Content {
  readonly node: Node
  readonly frame: RunFrame
  readonly props: object
}

// The props object a content fiber was last forked for, per content slot tree.
const forkedFor = new WeakMap<Slots, object>()

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
  Effect.flatMap(useLocal<Content | undefined>(undefined), ([content, set]) =>
    Effect.flatMap(Frame, (frame) => {
      const f = frame!
      const slots = contentSlots(f)
      const info = { fallback: props.fallback, content: props.children }
      // Discriminator: the instance's own `rerun` (fired by the slot set) passes the same props object, so stored content
      // for these props is emitted without forking; a fresh run (first mount, parent re-run) has new props and forks.
      if (content?.props !== props && forkedFor.get(slots) !== props) {
        forkedFor.set(slots, props)
        const scope = Effect.runSync(Scope.make())
        // ponytail: one closer per fork until the Pending is disposed; prune on commit if forks get frequent.
        slots.releases.push(() => closeScope(scope))
        const cframe = makeFrame(slots, `${f.id}/content`)
        const run = Fragment({ children: props.children }).pipe(
          Effect.provideService(Collector, undefined),
          Effect.provideService(Frame, cframe),
          Effect.provideService(RenderScope, scope),
          Effect.onExit((exit) =>
            Exit.isSuccess(exit) && forkedFor.get(slots) === props
              ? Effect.sync(() => set({ node: owned(exit.value, scope), frame: cframe, props }))
              : // ponytail: a failure is dropped here; the error path routes it (fn-24.2).
                Effect.sync(() => closeScope(scope)),
          ),
        )
        return Effect.flatMap(Effect.forkDaemon(run), (fiber) =>
          Effect.flatMap(Scope.addFinalizer(scope, Fiber.interruptFork(fiber)), () => emit(content, info, props)),
        )
      }
      return emit(content, info, props)
    }),
  ) as Effect.Effect<Node, never, never>

// Resolved content (current or previous) stays on screen; only a Pending with none yet shows the fallback.
const emit = (content: Content | undefined, info: { fallback: Child; content: Child }, props: { fallback: Child }): Effect.Effect<Node, any, any> =>
  content
    ? Effect.sync(() => (pendingOf.set(content.node, { ...info, frame: content.frame }), content.node))
    : Effect.map(scopedRun(Fragment({ children: props.fallback })), (n) => (pendingOf.set(n, info), n))
