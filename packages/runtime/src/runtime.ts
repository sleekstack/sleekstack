/**
 * packages/runtime/src/runtime.ts
 *
 * The framework-agnostic app runtime. `configureRuntime` stores the config; the
 * runtime is built lazily on first use and held in a versioned process-global
 * slot (`effect/GlobalValue`) so dev HMR and duplicate module copies share it.
 * The same config reference again is a no-op; a different config interrupts
 * in-flight `runEffect` calls, then disposes the old runtime.
 */

import { Cause, Context, Effect, Exit, Fiber, FiberId, FiberRef, Layer, ManagedRuntime, Runtime, Scope } from 'effect'
import { globalValue } from 'effect/GlobalValue'

/** Why an error was reported: a call's defect, a finalizer/disposal failure, or a failed layer build. */
export interface ErrorInfo {
  readonly phase: 'call' | 'finalizer' | 'build'
}

/** Receives defects, finalizer failures and failed builds (never interruptions or control flow). A throw is swallowed. */
export type ErrorSink = (cause: Cause.Cause<unknown>, info: ErrorInfo) => void

/** Config for {@link configureRuntime}: one `ManagedRuntime` over `layer`. */
export interface RuntimeConfig {
  /** Identity across module copies: a config with the same `id` as the current one is a no-op (first wins). */
  readonly id?: string
  readonly layer: Layer.Layer<never, unknown, never>
  /** One sink for everything reported; `info.phase` says which kind. Default: `console.error`. */
  readonly onError?: ErrorSink
  /** Classifies framework control-flow throws (rethrown untouched, never reported). Stored with the first config for an `id`. Default: nothing is control flow. */
  readonly isControlFlow?: ControlFlowClassifier
}

/** Decides whether a thrown/failed value is framework control flow (e.g. a redirect) rather than an error. */
export type ControlFlowClassifier = (value: unknown) => boolean

interface RuntimeSlot {
  config: RuntimeConfig | undefined
  /** In-progress interrupt-and-dispose of the previous runtime; new builds wait for it. */
  disposing: Promise<void> | undefined
  /** The `runEffect` runtime for the current config, created lazily; reset when its build fails. */
  runtime: ManagedRuntime.ManagedRuntime<any, any> | undefined
  /** In-flight `runEffect` fibers, interrupted on reconfigure before the runtime is disposed. */
  fibers: Set<Fiber.RuntimeFiber<any, any>>
  /** Dev-only devtools buffer (newest last, at most {@link DEV_EVENT_LIMIT}); cleared on reconfigure. */
  events: DevEvent[]
  /** Dev-only live state, kept apart from the bounded history so eviction never hides it. */
  live: { app: boolean; scopes: Set<string> }
  nextScopeId: number
}

/** @internal One devtools buffer entry: a per-call scope, the app runtime's acquire/release, or a reported error. */
export interface DevEvent {
  readonly at: number
  readonly kind: 'scope-open' | 'scope-close' | 'acquire' | 'release' | 'error'
  readonly label: string
  readonly detail?: string
  /** Owning scope: `app` or a `request#N` label. Errors keep it after the scope leaves `live`. */
  readonly scope?: string
  /** The fiber that emitted the event (acquire/release hooks only). */
  readonly fiber?: string
}

/** @internal Devtools buffer capacity. */
export const DEV_EVENT_LIMIT = 200

/** Recording is off in production; call sites check this first so disabled recording builds nothing. */
/** @internal */
export const devEnabled = (): boolean =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'

/**
 * Records into the buffer only while `config` is still the current one: late events from a replaced runtime
 * are dropped. Never throws: a devtools hook must not fail a request.
 */
const record = (config: RuntimeConfig, kind: DevEvent['kind'], label: string, detail?: string, extra: { scope?: string; fiber?: string } = {}): void => {
  try {
    const slot = getSlot()
    if (slot.config !== config) return
    const events = slot.events
    events.push({ at: Date.now(), kind, label, ...(detail !== undefined && { detail }), ...extra })
    if (events.length > DEV_EVENT_LIMIT) events.splice(0, events.length - DEV_EVENT_LIMIT)
  } catch {
    // ignored by design
  }
}

/** @internal The devtools buffer, read by adapters' devtools handlers (e.g. `@sleekstack/next/devtools`). */
export const devEvents = (): readonly DevEvent[] => getSlot().events

/** @internal Currently open request scopes and whether the app runtime is built. */
export const devLive = (): { readonly app: boolean; readonly scopes: readonly string[] } => {
  const { app, scopes } = getSlot().live
  return { app, scopes: [...scopes] }
}

const setLive = (config: RuntimeConfig, update: (live: RuntimeSlot['live']) => void): void => {
  const slot = getSlot()
  if (slot.config === config) update(slot.live)
}

/** The config and scope label a fiber is tracing into; set by the runtime around the app build and each call, dev only. */
const currentTrace = globalValue('@sleekstack/runtime/current-trace', () =>
  FiberRef.unsafeMake<{ readonly config: RuntimeConfig; readonly scope: string } | undefined>(undefined),
)

/**
 * @internal Wraps a service Layer so its acquire/release land in the devtools buffer, one event per id (the analyzer's node ids), the owning
 * scope and the fiber. No-op outside a runtime-traced fiber, and the caller wraps only in dev.
 */
export const traceService = <A, E, R>(ids: readonly string[], layer: Layer.Layer<A, E, R>): Layer.Layer<A, E, R> =>
  Layer.provideMerge(
    Layer.scopedDiscard(
      Effect.acquireRelease(
        Effect.flatMap(Effect.zip(FiberRef.get(currentTrace), Effect.fiberId), ([trace, fiber]) =>
          Effect.sync(() => {
            if (trace) for (const id of ids) record(trace.config, 'acquire', id, undefined, { scope: trace.scope, fiber: FiberId.threadName(fiber) })
            return trace
          }),
        ),
        (trace) =>
          Effect.flatMap(Effect.fiberId, (fiber) =>
            Effect.sync(() => {
              if (trace) for (const id of ids) record(trace.config, 'release', id, undefined, { scope: trace.scope, fiber: FiberId.threadName(fiber) })
            }),
          ),
      ),
    ),
    layer,
  )

const getSlot = (): RuntimeSlot =>
  globalValue('@sleekstack/next/runtime-slot/v3', (): RuntimeSlot => ({
    config: undefined,
    disposing: undefined,
    runtime: undefined,
    fibers: new Set(),
    events: [],
    live: { app: false, scopes: new Set() },
    nextScopeId: 0,
  }))

const defaultSink: ErrorSink = (cause) => console.error(Cause.pretty(cause))

/**
 * Stores the runtime config. The same reference, or a config with the same `id` (so duplicate module
 * copies, e.g. the RSC and action bundles, agree on one runtime), is a no-op; anything else interrupts
 * in-flight `runEffect` calls, then disposes the current runtime and replaces it. The runtime is
 * built lazily on first use.
 *
 * @param config - `{ layer, onError?, id? }`.
 * @param options - `replace: true` replaces the runtime even for the same `id` (a dev hot reload of the module that configures it).
 *
 * @example
 * ```ts
 * import { Layer } from 'effect'
 * import { configureRuntime } from '@sleekstack/runtime'
 *
 * configureRuntime({ layer: Layer.empty })
 * ```
 */
export function configureRuntime(config: RuntimeConfig, options: { readonly replace?: boolean } = {}): void {
  const slot = getSlot()
  const same = slot.config === config || (config.id !== undefined && slot.config?.id === config.id)
  if (same && !options.replace) return
  if (slot.config !== undefined) {
    console.warn(
      '[@sleekstack/runtime] configureRuntime() was called again with a different config; disposing the previous app runtime and replacing it.',
    )
    const previous = slot.config
    const runtime = slot.runtime
    const fibers = [...slot.fibers]
    // New builds wait for this, so the old runtime's resources are released before the new ones are acquired.
    slot.disposing = Effect.runPromise(Fiber.interruptAll(fibers)).then(() => (runtime ? disposeReported(previous, runtime) : undefined))
  }
  slot.events = []
  slot.live = { app: false, scopes: new Set() }
  slot.config = config
  slot.runtime = undefined
  slot.fibers = new Set()
}

/** Descriptive error for an unconfigured call, thrown at call time. */
export class RuntimeNotConfigured extends Error {
  constructor() {
    super('[@sleekstack/runtime] runEffect was called before configureRuntime(); call configureRuntime({ layer }) first.')
    this.name = 'RuntimeNotConfigured'
  }
}

/** Options for {@link runEffect}. */
export interface RunEffectOptions {
  /** Built per call and released when the call ends. */
  readonly request?: Layer.Layer<any, any, any>
  /** Provided outside `request`: shadows services for both the effect and `request`'s services. */
  readonly overrides?: Layer.Layer<any, any, any>
  /** Classifier used when the configured runtime has none (an adapter preset passes its own). */
  readonly isControlFlow?: ControlFlowClassifier
}

const neverControlFlow: ControlFlowClassifier = () => false

/** The config's classifier, else the per-call fallback; read defensively since an older copy's config has none. */
const classifierFor = (config: RuntimeConfig, fallback: ControlFlowClassifier | undefined): ControlFlowClassifier =>
  typeof config.isControlFlow === 'function' ? config.isControlFlow : (fallback ?? neverControlFlow)

/** The first classified value, boxed so a classified `undefined` is distinguishable from no match. */
const findControlFlow = (cause: Cause.Cause<unknown>, isControlFlow: ControlFlowClassifier): { readonly value: unknown } | undefined => {
  const values = [...Cause.defects(cause), ...Cause.failures(cause)]
  const i = values.findIndex(isControlFlow)
  return i === -1 ? undefined : { value: values[i] }
}

const callSink = (config: RuntimeConfig, cause: Cause.Cause<unknown>, phase: ErrorInfo['phase'], scope?: string): void => {
  if (devEnabled()) record(config, 'error', Cause.isDie(cause) ? 'defect' : 'failure', Cause.pretty(cause), scope ? { scope } : {})
  try {
    ;(config.onError ?? defaultSink)(cause, { phase })
  } catch (sinkError) {
    console.error('[@sleekstack/runtime] error sink threw; swallowing so the call result is unaffected:', sinkError)
  }
}

const report = (config: RuntimeConfig, cause: Cause.Cause<unknown>, phase: ErrorInfo['phase'] = 'call', scope?: string): void => callSink(config, cause, phase, scope)

const reportFinalizer = (config: RuntimeConfig, cause: Cause.Cause<unknown>, scope?: string): void => callSink(config, cause, 'finalizer', scope)

/**
 * @internal For adapters that own finalizers inside the app layer (kit's app scope): routes a
 * finalizer failure to the current config's `onError` with `phase: 'finalizer'`.
 */
export const reportFinalizerFailure = (cause: Cause.Cause<unknown>): void => {
  const config = getSlot().config
  if (config) reportFinalizer(config, cause)
}

/** Disposes `runtime`, routing a finalizer failure to the finalizer sink instead of an unhandled rejection. */
const disposeReported = async (config: RuntimeConfig, runtime: ManagedRuntime.ManagedRuntime<any, any>, scope?: string): Promise<void> => {
  const exit = await Effect.runPromiseExit(runtime.disposeEffect)
  if (Exit.isFailure(exit)) reportFinalizer(config, exit.cause, scope)
}

const runtimeFor = (slot: RuntimeSlot, config: RuntimeConfig): ManagedRuntime.ManagedRuntime<any, any> => {
  if (slot.runtime) return slot.runtime
  const layer = config.layer
  // Recorded by the layer itself, after everything it provides is built and before it is released,
  // so `getRuntime()` users and every disposal path are covered.
  const tracked = devEnabled()
    ? Layer.provideMerge(
        Layer.scopedDiscard(
          Effect.acquireRelease(
            Effect.sync(() => {
              setLive(config, (l) => void (l.app = true))
              record(config, 'acquire', 'app')
            }),
            () =>
              Effect.sync(() => {
                setLive(config, (l) => void (l.app = false))
                record(config, 'release', 'app')
              }),
          ),
        ),
        Layer.locally(layer, currentTrace, { config, scope: 'app' }),
      )
    : layer
  return (slot.runtime = ManagedRuntime.make(tracked as Layer.Layer<never, unknown, never>) as ManagedRuntime.ManagedRuntime<any, any>)
}

/**
 * Runs `effect` on the configured runtime. `request` is built per call and released when the call
 * ends; `overrides` shadow both the effect's services and `request`'s. Defects and finalizer failures
 * go to `onError` once each; a finalizer failure never changes the result.
 *
 * @param effect - The Effect to run.
 * @param options - Optional per-call `request` and `overrides` Layers, and a fallback `isControlFlow`.
 * @returns A promise of the Effect's value.
 * @throws `RuntimeNotConfigured` (rejection) when `runEffect` is called before `configureRuntime`.
 * @throws `FiberFailure` (rejection, as `Effect.runPromise`) on a typed failure, defect or interruption;
 *   a value the classifier marks as control flow is rethrown as-is.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from 'effect'
 * import { configureRuntime, runEffect } from '@sleekstack/runtime'
 *
 * configureRuntime({ layer: Layer.empty })
 * await runEffect(Effect.succeed(1))
 * ```
 */
export async function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>, options: RunEffectOptions = {}): Promise<A> {
  const slot = getSlot()
  const config = slot.config
  if (config === undefined) throw new RuntimeNotConfigured()
  const runtime = runtimeFor(slot, config)
  const disposing = slot.disposing
  const isControlFlow = classifierFor(config, options.isControlFlow)
  const scopeLabel = devEnabled() ? `request#${++slot.nextScopeId}` : ''
  const program = Effect.gen(function* () {
    const scope = yield* Scope.make()
    if (scopeLabel) {
      setLive(config, (l) => void l.scopes.add(scopeLabel))
      record(config, 'scope-open', scopeLabel)
    }
    const exit = yield* Effect.exit(
      Effect.gen(function* () {
        const base = Context.empty() as Context.Context<any>
        const overrides: Context.Context<any> = options.overrides
          ? yield* Layer.buildWithScope(options.overrides, scope).pipe(Effect.provide(base))
          : (Context.empty() as Context.Context<any>)
        const request: Context.Context<any> = options.request
          ? yield* Layer.buildWithScope(scopeLabel ? traceService(['request'], options.request) : options.request, scope).pipe(Effect.provide(Context.merge(base, overrides)))
          : (Context.empty() as Context.Context<any>)
        // Later contexts win: overrides shadow request services, which shadow the base.
        const context = Context.merge(Context.merge(base, request), overrides) as Context.Context<R>
        return yield* Effect.provide(effect, context)
      }),
    )
    const closeExit = yield* Effect.exit(Scope.close(scope, exit))
    if (scopeLabel) setLive(config, (l) => void l.scopes.delete(scopeLabel))
    if (scopeLabel) record(config, 'scope-close', scopeLabel, Exit.isSuccess(exit) ? 'success' : 'failure')
    if (Exit.isFailure(closeExit)) reportFinalizer(config, closeExit.cause, scopeLabel || undefined)
    return exit
  }).pipe((p) => (scopeLabel ? Effect.locally(p, currentTrace, { config, scope: scopeLabel }) : p))

  // The call is registered synchronously, before the runtime finishes building, so a `configureRuntime()`
  // issued right after this call starts can still interrupt it.
  const fiber = Effect.runFork(
    Effect.gen(function* () {
      if (disposing) yield* Effect.promise(() => disposing)
      const built = yield* Effect.exit(runtime.runtimeEffect)
      if (Exit.isFailure(built)) return { buildFailure: built.cause } as const
      return { exit: yield* Effect.provide(program, built.value) } as const
    }),
  )
  slot.fibers.add(fiber)
  const outcome = await new Promise<Exit.Exit<{ buildFailure: Cause.Cause<unknown> } | { exit: Exit.Exit<A, unknown> }, never>>((resolve) =>
    fiber.addObserver(resolve as never),
  )
  slot.fibers.delete(fiber)
  if (Exit.isSuccess(outcome) && 'buildFailure' in outcome.value) {
    const failure = outcome.value.buildFailure
    // A failed build is not cached: the next call builds again.
    if (slot.runtime === runtime) slot.runtime = undefined
    const controlFlow = findControlFlow(failure, isControlFlow)
    if (controlFlow === undefined && !Cause.isInterruptedOnly(failure)) report(config, failure, 'build', scopeLabel || undefined)
    await disposeReported(config, runtime, scopeLabel || undefined)
    if (controlFlow !== undefined) throw controlFlow.value
    // Reject exactly as `Effect.runPromise` would.
    await Effect.runPromise(Effect.failCause(failure))
  }
  // An interrupted fiber never reaches `return`; its own Exit is the outcome.
  const exit: Exit.Exit<A, unknown> = Exit.isSuccess(outcome) ? (outcome.value as { exit: Exit.Exit<A, unknown> }).exit : (outcome as unknown as Exit.Exit<never, unknown>)
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  const controlFlow = findControlFlow(cause, isControlFlow)
  if (controlFlow !== undefined) throw controlFlow.value
  if (!Cause.isInterruptedOnly(cause) && Cause.isDie(cause)) report(config, cause, 'call', scopeLabel || undefined)
  throw Runtime.makeFiberFailure(cause)
}

/**
 * The configured `ManagedRuntime`, created lazily. It is unmanaged: calls made on it directly are not
 * tracked, so a later `configureRuntime` neither interrupts them nor waits for them (use {@link runEffect}).
 *
 * @throws `RuntimeNotConfigured` when `getRuntime` is called before `configureRuntime`.
 */
export function getRuntime(): ManagedRuntime.ManagedRuntime<any, any> {
  const slot = getSlot()
  if (slot.config === undefined) throw new RuntimeNotConfigured()
  return runtimeFor(slot, slot.config)
}
