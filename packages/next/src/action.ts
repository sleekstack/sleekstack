/**
 * packages/next/src/action.ts
 *
 * action()/query() (R8): each call opens a request scope over the app scope,
 * runs `fn`, checks the result for stream shapes, closes the scope (always,
 * regardless of outcome), then settles. Typed failures and defects reject
 * with an Error whose `cause` carries the Effect Cause. Request-scope
 * finalizer failures never change the op's own result; they go to the
 * configured `onFinalizerError` sink.
 */

import type { Entry } from '@sleekstack/core'
import { Cause, Effect, Exit } from 'effect'
import { defaultFinalizerSink, ensureAppScope, getConfiguredSink } from './runtime'

export interface OperationOptions {
  /** Built in the request scope, shadowing the global graph for this call only. */
  readonly provide?: readonly Entry[]
}

type OperationFn<A extends readonly unknown[], R, E> = (...args: A) => Effect.Effect<R, E, any>

export interface Operation {
  <A extends readonly unknown[], R, E>(fn: OperationFn<A, R, E>): (...args: A) => Promise<R>
  <A extends readonly unknown[], R, E>(
    options: OperationOptions,
    fn: OperationFn<A, R, E>,
  ): (...args: A) => Promise<R>
}

const isStreamShaped = (value: unknown): boolean =>
  (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function')

class StreamingResultNotSupported extends Error {
  constructor() {
    super(
      '[@sleekstack/next] action/query returned a ReadableStream or async iterable; streaming results are not supported because the request scope closes before the stream is consumed.',
    )
    this.name = 'StreamingResultNotSupported'
  }
}

const toRejection = (cause: Cause.Cause<unknown>): Error => new Error(Cause.pretty(cause), { cause })

async function run<A extends readonly unknown[], R, E>(
  options: OperationOptions,
  fn: OperationFn<A, R, E>,
  args: A,
): Promise<R> {
  const appScope = await ensureAppScope()
  const program = Effect.gen(function* () {
    const requestScope = yield* appScope.child('request', options.provide ?? [])
    // Deferred: a synchronous throw from `fn(...args)` itself (before it returns an Effect) must
    // still flow through this pipe so the request scope closes below, instead of escaping the
    // Effect.gen as an unhandled exception.
    return yield* Effect.suspend(() => fn(...args)).pipe(
      Effect.provide(requestScope.context as any),
      Effect.flatMap((value) => (isStreamShaped(value) ? Effect.fail(new StreamingResultNotSupported()) : Effect.succeed(value))),
      Effect.onExit(() =>
        requestScope.close.pipe(
          Effect.flatMap((closeExit) => {
            if (Exit.isFailure(closeExit)) reportRequestScopeFinalizerFailure(closeExit.cause)
            return Effect.void
          }),
        ),
      ),
    )
  })
  const exit = await Effect.runPromiseExit(program as Effect.Effect<R, unknown, never>)
  if (Exit.isSuccess(exit)) return exit.value as R
  throw toRejection(exit.cause)
}

function reportRequestScopeFinalizerFailure(cause: Cause.Cause<unknown>): void {
  const sink = getConfiguredSink() ?? defaultFinalizerSink
  // A throwing sink must never turn a successful (or already-failed) op into a different outcome.
  try {
    sink(cause)
  } catch (sinkError) {
    console.error('[@sleekstack/next] onFinalizerError sink threw; swallowing so the op result is unaffected:', sinkError)
  }
}

function makeOperation(): Operation {
  return ((optionsOrFn: OperationOptions | OperationFn<any, any, any>, maybeFn?: OperationFn<any, any, any>) => {
    const [options, fn] =
      typeof optionsOrFn === 'function' ? [{} as OperationOptions, optionsOrFn] : [optionsOrFn, maybeFn!]
    return (...args: any[]) => run(options, fn, args)
  }) as Operation
}

export const action: Operation = makeOperation()
export const query: Operation = makeOperation()
