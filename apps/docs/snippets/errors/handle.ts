import { Effect } from 'effect'
import { makeAppScope, type GraphError, type Module } from '@sleekstack/core'

declare const AppModule: Module

// Graph errors are Effect tagged errors, so `catchTags` handles them by code.
// `sleekstack check` reports the same codes at build time.
export const open = makeAppScope([AppModule]).pipe(
  Effect.catchTags({
    MissingDependency: (e: GraphError) => Effect.fail(`provide the missing Tag: ${e.message}`),
    DuplicateModule: (e: GraphError) => Effect.fail(`rename one of the modules: ${e.message}`),
  }),
)
