import { Context, Effect, Exit, type Cause } from 'effect'
import { makeAppScope } from '@sleekstack/core'
import { normalize } from '../errors'
import { unwrap, validateProvide, type Module } from '../module'
import { coreTag, type AnyTag } from '../tag'

/** Builds the app scope for `app` through the kit lowering; kit errors normalized. */
export async function boot(app: Module, onFinalizerError?: (c: Cause.Cause<unknown>) => void) {
  validateProvide([app])
  const exit = await Effect.runPromiseExit(makeAppScope(unwrap([app]), onFinalizerError ? { onFinalizerError } : {}))
  if (Exit.isFailure(exit)) throw normalize(exit.cause)
  const scope = exit.value
  return { get: <T>(t: AnyTag) => Context.unsafeGet(scope.context, coreTag(t)) as T, scope }
}

export const err = (f: () => unknown) => {
  try { f() } catch (e) { return e as Error & { code?: string; details?: Record<string, unknown> } }
  throw new Error('did not throw')
}
