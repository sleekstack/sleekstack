import { Context, Effect } from 'effect'
import { defineEffect, query } from '@sleekstack/kit/next'
import { importedBody, readFar } from './ext'

export class Far extends Context.Tag('Far')<Far, string>() {}
class Plain { *[Symbol.iterator]() { return 1 } }
const loose: any = Effect.succeed(1)
const makeReader = () => Effect.gen(function* () { return yield* Far })

export const viaR = defineEffect(function* () {
  yield* Effect.succeed(1)
  yield* Effect.map(Far, (s) => s) // @error MissingDependency
  yield* readFar() // @error MissingDependency
  yield* makeReader() // @error MissingDependency
  yield* Effect.gen(function* () { return yield* Far }) // @error MissingDependency
  yield* new Plain() // @error Unresolvable
  return yield* loose // @error Unresolvable
})

export const bodiless = () => query(importedBody) // @error Unresolvable
