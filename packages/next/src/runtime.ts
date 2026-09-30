/**
 * packages/next/src/runtime.ts
 *
 * The Next adapter's app runtime. `configureRuntime` stores the config; the
 * runtime is built lazily on first use and held in a versioned process-global
 * slot (`effect/GlobalValue`) so dev HMR and duplicate module copies share it.
 * The same config reference again is a no-op; a different config interrupts
 * in-flight `runEffect` calls, then disposes the old runtime.
 */

import { makeAppScope, type AppScope, type Entry, type Module } from '@sleekstack/core'
import { Cause, Context, Effect, Exit, Fiber, Layer, ManagedRuntime, Runtime, Scope } from 'effect'
import { globalValue } from 'effect/GlobalValue'

/** Receives defects and finalizer failures (never typed failures, interruptions or Next control flow). A throw is swallowed. */
type ErrorSink = (cause: Cause.Cause<unknown>) => void

/** Layer-based config: one `ManagedRuntime` over `layer`. */
export interface LayerRuntimeConfig {
  readonly layer: Layer.Layer<never, unknown, never>
  readonly onError?: ErrorSink
  readonly provide?: undefined
  readonly onFinalizerError?: undefined
}

/** Module-based config: the app's root modules/entries, built as a core app scope. */
export interface ProvideRuntimeConfig {
  readonly provide: readonly (Module | Entry)[]
  readonly onFinalizerError?: ErrorSink
  readonly onError?: ErrorSink
  readonly layer?: undefined
}

/** Config for {@link configureRuntime}: either a plain Effect `layer` or core `provide` modules/entries. */
export type RuntimeConfig = LayerRuntimeConfig | ProvideRuntimeConfig

interface RuntimeSlot {
  config: RuntimeConfig | undefined
  /** The `runEffect` runtime for the current config, created lazily; reset when its build fails. */
  runtime: ManagedRuntime.ManagedRuntime<any, any> | undefined
  /** In-flight `runEffect` fibers, interrupted on reconfigure before the runtime is disposed. */
  fibers: Set<Fiber.RuntimeFiber<any, any>>
}

const getSlot = (): RuntimeSlot =>
  globalValue('@sleekstack/next/runtime-slot/v2', (): RuntimeSlot => ({
    config: undefined,
    runtime: undefined,
    fibers: new Set(),
  }))

const defaultFinalizerSink = (cause: Cause.Cause<unknown>): void => console.error(Cause.pretty(cause))

const sinkFor = (config: RuntimeConfig): ErrorSink => config.onFinalizerError ?? config.onError ?? defaultFinalizerSink

/**
 * Stores the runtime config. Same reference again is a no-op; a different reference interrupts
 * in-flight `runEffect` calls, then disposes the current runtime and replaces it. The runtime is
 * built lazily on first use.
 *
 * @param config - `{ layer, onError? }`, or root modules/entries as `{ provide, onFinalizerError? }`.
 *
 * @example
 * ```ts
 * import { Layer } from 'effect'
 * import { configureRuntime } from '@sleekstack/next'
 *
 * configureRuntime({ layer: Layer.empty })
 * ```
 */
export function configureRuntime(config: RuntimeConfig): void {
  const slot = getSlot()
  if (slot.config === config) return
  if (slot.config !== undefined) {
    console.warn(
      '[@sleekstack/next] configureRuntime() was called again with a different config; disposing the previous app runtime and replacing it.',
    )
    const previous = slot.config
    const runtime = slot.runtime
    const fibers = [...slot.fibers]
    void Effect.runPromise(Fiber.interruptAll(fibers)).then(() => runtime && disposeReported(previous, runtime))
  }
  slot.config = config
  slot.runtime = undefined
  slot.fibers = new Set()
}

/** Descriptive error for an unconfigured call, thrown at call time. */
export class RuntimeNotConfigured extends Error {
  constructor() {
    super('[@sleekstack/next] runEffect was called before configureRuntime(); call configureRuntime({ layer }) first.')
    this.name = 'RuntimeNotConfigured'
  }
}

/** Options for {@link runEffect}. */
export interface RunEffectOptions {
  /** Built per call and released when the call ends. */
  readonly request?: Layer.Layer<any, any, any>
  /** Provided outside `request`: shadows services for both the effect and `request`'s services. */
  readonly overrides?: Layer.Layer<any, any, any>
  /**
   * @internal For kit (ADR 0009): child-boundary modules/entries built into the per-call request
   * scope under a `provide` config, so modules keep their privacy and local-over-import shadowing.
   */
  readonly provide?: readonly (Module | Entry)[]
}

const AppScopeTag = Context.GenericTag<AppScope>('@sleekstack/next/AppScope')

/** Next.js control-flow throws (`redirect()`, `notFound()`, `forbidden()`, ...): rethrown untouched, never reported. */
const isNextControlFlow = (value: unknown): boolean => {
  const digest = (value as { digest?: unknown } | null)?.digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') || digest === 'NEXT_NOT_FOUND')
  )
}

const callSink = (sink: ErrorSink, cause: Cause.Cause<unknown>): void => {
  try {
    sink(cause)
  } catch (sinkError) {
    console.error('[@sleekstack/next] error sink threw; swallowing so the call result is unaffected:', sinkError)
  }
}

/** Defects: `onError`, else the default logger. */
const report = (config: RuntimeConfig, cause: Cause.Cause<unknown>): void =>
  callSink(config.onError ?? defaultFinalizerSink, cause)

/** Finalizer and disposal failures: `onFinalizerError`, else `onError`, else the default logger. */
const reportFinalizer = (config: RuntimeConfig, cause: Cause.Cause<unknown>): void => callSink(sinkFor(config), cause)

/** Disposes `runtime`, routing a finalizer failure to the finalizer sink instead of an unhandled rejection. */
const disposeReported = async (config: RuntimeConfig, runtime: ManagedRuntime.ManagedRuntime<any, any>): Promise<void> => {
  const exit = await Effect.runPromiseExit(runtime.disposeEffect)
  if (Exit.isFailure(exit)) reportFinalizer(config, exit.cause)
}

const runtimeFor = (slot: RuntimeSlot, config: RuntimeConfig): ManagedRuntime.ManagedRuntime<any, any> => {
  if (slot.runtime) return slot.runtime
  const layer: Layer.Layer<never, unknown, never> =
    config.layer ??
    Layer.scoped(
      AppScopeTag,
      Effect.acquireRelease(makeAppScope(config.provide, { onFinalizerError: sinkFor(config) }), (app) =>
        Effect.flatMap(app.close, (exit) => Effect.sync(() => void (Exit.isFailure(exit) && reportFinalizer(config, exit.cause)))),
      ),
    )
  return (slot.runtime = ManagedRuntime.make(layer) as ManagedRuntime.ManagedRuntime<any, any>)
}

/**
 * Runs `effect` on the configured runtime. `request` is built per call and released when the call
 * ends; `overrides` shadow both the effect's services and `request`'s. Defects and finalizer failures
 * go to `onError` once each; a finalizer failure never changes the result.
 *
 * @param effect - The Effect to run.
 * @param options - Optional per-call `request` and `overrides` Layers.
 * @returns A promise of the Effect's value.
 * @throws `RuntimeNotConfigured` (rejection) when `runEffect` is called before `configureRuntime`.
 * @throws `FiberFailure` (rejection, as `Effect.runPromise`) on a typed failure, defect or interruption;
 *   a Next `redirect()`/`notFound()` throw is rethrown as-is.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from 'effect'
 * import { configureRuntime, runEffect } from '@sleekstack/next'
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
  const built = await Effect.runPromiseExit(runtime.runtimeEffect)
  if (Exit.isFailure(built)) {
    // A failed build is not cached: the next call builds again.
    if (slot.runtime === runtime) slot.runtime = undefined
    const controlFlow = [...Cause.defects(built.cause)].find(isNextControlFlow)
    if (controlFlow === undefined && !Cause.isInterruptedOnly(built.cause) && Cause.isDie(built.cause)) report(config, built.cause)
    await disposeReported(config, runtime)
    // Reject exactly as `Effect.runPromise` would.
    await Effect.runPromise(Effect.failCause(built.cause))
  }

  const program = Effect.gen(function* () {
    const scope = yield* Scope.make()
    const exit = yield* Effect.exit(
      Effect.gen(function* () {
        let base= Context.empty() as Context.Context<any>
        if (config.layer === undefined) {
          const app = yield* AppScopeTag
          const requestScope = yield* app.child('request', options.provide ?? [])
          yield* Scope.addFinalizer(
            scope,
            Effect.flatMap(requestScope.close, (e) => Effect.sync(() => void (Exit.isFailure(e) && reportFinalizer(config, e.cause)))),
          )
          base = requestScope.context
        } else if (options.provide?.length) {
          return yield* Effect.die(new Error('[@sleekstack/next] runEffect({ provide }) needs configureRuntime({ provide }).'))
        }
        const overrides: Context.Context<any> = options.overrides
          ? yield* Layer.buildWithScope(options.overrides, scope).pipe(Effect.provide(base))
          : (Context.empty() as Context.Context<any>)
        const request: Context.Context<any> = options.request
          ? yield* Layer.buildWithScope(options.request, scope).pipe(Effect.provide(Context.merge(base, overrides)))
          : (Context.empty() as Context.Context<any>)
        // Later contexts win: overrides shadow request services, which shadow the base.
        const context = Context.merge(Context.merge(base, request), overrides) as Context.Context<R>
        return yield* Effect.provide(effect, context)
      }),
    )
    const closeExit = yield* Effect.exit(Scope.close(scope, exit))
    if (Exit.isFailure(closeExit)) reportFinalizer(config, closeExit.cause)
    return exit
  })

  const fiber = runtime.runFork(program as Effect.Effect<Exit.Exit<A, unknown>, never, any>)
  slot.fibers.add(fiber)
  const outcome = await new Promise<Exit.Exit<Exit.Exit<A, unknown>, unknown>>((resolve) => fiber.addObserver(resolve))
  slot.fibers.delete(fiber)
  // An interrupted fiber never reaches `return exit`; its own Exit is the outcome.
  const exit: Exit.Exit<A, unknown> = Exit.isSuccess(outcome) ? outcome.value : (outcome as Exit.Exit<never, unknown>)
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  const controlFlow = [...Cause.defects(cause)].find(isNextControlFlow)
  if (controlFlow !== undefined) throw controlFlow
  if (!Cause.isInterruptedOnly(cause) && Cause.isDie(cause)) report(config, cause)
  throw Runtime.makeFiberFailure(cause)
}

/**
 * The configured `ManagedRuntime`, created lazily.
 *
 * @throws `RuntimeNotConfigured` when `getRuntime` is called before `configureRuntime`.
 */
export function getRuntime(): ManagedRuntime.ManagedRuntime<any, any> {
  const slot = getSlot()
  if (slot.config === undefined) throw new RuntimeNotConfigured()
  return runtimeFor(slot, slot.config)
}
