/**
 * packages/react/src/useTransition.ts
 *
 * `useEffectTransition`: runs an Effect on a fiber and commits its Exit in a React transition,
 * with the nearest LayerProvider's services.
 *
 *   requests ──Queue──▶ Stream.flatMap({ switch: true }) ──▶ commit in startTransition
 *   pending  ──SubscriptionRef──▶ useSyncExternalStore
 *   lifetime ──Scope── closed on unmount: every fiber interrupted, finalizers run
 */
import { Context, Effect, Exit, Queue, Scope, Stream, SubscriptionRef } from 'effect'
import { startTransition, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ProviderContext } from './context'

// ---- internal: the provider's service context, suspending like useService --
// (same pattern as useStore in atoms.ts)
function useScopeContext(hook: string): Context.Context<any> {
  const state = useContext(ProviderContext)
  if (state === null) {
    throw new Error(
      `${hook} needs a <LayerProvider> above this component: its services come from the nearest provider.`,
    )
  }
  const s = state.scopeState
  if (s.status === 'resolved') return s.scope.context
  if (s.status === 'rejected') throw s.error
  state.start()
  throw state.scope
}

// ---- the Effect program ----------------------------------------------------
interface Transition<In> {
  readonly send: (input: In) => Effect.Effect<void>
  readonly pending: SubscriptionRef.SubscriptionRef<boolean>
}

/** Scoped: forks the switch-loop into the ambient Scope. */
const makeTransition = <In, A, E, R>(
  work: (input: In) => Effect.Effect<A, E, R>,
  commit: (exit: Exit.Exit<A, E>) => void,
): Effect.Effect<Transition<In>, never, R | Scope.Scope> =>
  Effect.gen(function* () {
    const requests = yield* Queue.unbounded<In>()
    const pending = yield* SubscriptionRef.make(false)

    yield* Stream.fromQueue(requests).pipe(
      Stream.flatMap(
        (input) => Stream.fromEffect(Effect.exit(work(input))),
        { switch: true }, // latest wins; superseded fibers are interrupted, never emit
      ),
      Stream.runForEach((exit) =>
        Effect.zipRight(
          Effect.sync(() => startTransition(() => commit(exit))),
          SubscriptionRef.set(pending, false),
        ),
      ),
      Effect.forkScoped,
    )

    return {
      pending,
      send: (input) => Effect.zipRight(SubscriptionRef.set(pending, true), Queue.offer(requests, input)),
    }
  })

// ---- the thin React edge ---------------------------------------------------
/**
 * Runs `work` in a React transition on a fiber, with the nearest LayerProvider's services.
 * A newer `send` interrupts the previous run; unmount interrupts everything.
 * Suspends until the provider's scope is built. `R` is the services `work` needs; as with
 * `useService`, they are resolved at run time, not checked against the provider.
 */
export function useEffectTransition<In, A, E, R = never>(
  work: (input: In) => Effect.Effect<A, E, R>,
  commit: (exit: Exit.Exit<A, E>) => void,
) {
  const ctx = useScopeContext('useEffectTransition') as Context.Context<R>

  // latest closures without restarting the loop
  const latest = useRef({ work, commit })
  latest.current = { work, commit }

  const [tr, setTr] = useState<Transition<In> | null>(null)
  // sends made before the mount effect has built the transition; replayed in order (latest wins)
  const early = useRef<In[]>([])
  const live = useRef<Transition<In> | null>(null)

  useEffect(() => {
    const scope = Effect.runSync(Scope.make())
    const t = Effect.runSync(
      makeTransition<In, A, E, R>(
        (i) => latest.current.work(i),
        (x) => latest.current.commit(x),
      ).pipe(Scope.extend(scope), Effect.provide(ctx)),
    )
    live.current = t
    for (const i of early.current.splice(0)) Effect.runFork(t.send(i))
    setTr(t)
    return () => {
      live.current = null
      Effect.runFork(Scope.close(scope, Exit.void)) // interrupts all
    }
  }, [ctx])

  const isPending = useSyncExternalStore(
    useCallback(
      (cb) => {
        if (!tr) return () => {}
        const cancel = Effect.runCallback(tr.pending.changes.pipe(Stream.runForEach(() => Effect.sync(cb))))
        return () => cancel()
      },
      [tr],
    ),
    () => (tr ? Effect.runSync(SubscriptionRef.get(tr.pending)) : false),
    () => false,
  )

  // reads a ref, not `tr`: a stale closure between the effect and its re-render must not drop the send
  const send = useCallback(
    (i: In) => void (live.current ? Effect.runFork(live.current.send(i)) : early.current.push(i)),
    [],
  )
  return [isPending, send] as const
}
