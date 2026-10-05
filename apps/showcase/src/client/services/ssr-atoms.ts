/**
 * apps/showcase/src/client/services/ssr-atoms.ts
 *
 * Serializable atoms for the `/atoms` page (R5). Shared by the server component (`prefetchAtoms`) and the
 * client reader, so no `'use client'`. Every run of `serverTime` bumps `globalThis.__ssrAtomRuns`; the e2e
 * reads it in the browser to prove the seeded Effect never ran on the client.
 */
import { Atom, type Result } from '@sleekstack/core'
import { Effect, Schema } from 'effect'

const g = globalThis as { __ssrAtomRuns?: number }

/** An Effect atom: the run number and when it ran. Seeded on the client, so it never runs there. */
export const serverTime: Atom.Serializable<
  Atom.Atom<Result.Result<{ readonly run: number; readonly at: string }, Atom.ScopeError>>
> = Atom.serializable.result(
  Atom.make(Effect.sync(() => ({ run: (g.__ssrAtomRuns = (g.__ssrAtomRuns ?? 0) + 1), at: new Date().toISOString() }))),
  { key: 'showcase/serverTime', schema: Schema.Struct({ run: Schema.Number, at: Schema.String }) },
)

/** A sync writable atom, seeded from the server value. */
export const greeting = Atom.serializable(Atom.make('hello from the server'), {
  key: 'showcase/greeting',
  schema: Schema.String,
})
