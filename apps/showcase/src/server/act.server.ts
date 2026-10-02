/**
 * apps/showcase/src/server/act.server.ts
 *
 * Adapts a use case to a Server Action. Next production hides thrown server messages, so a modeled
 * `DomainError` becomes `{ ok: false, error }`; a defect rejects and reaches `error.tsx`.
 */
import 'server-only'
import { Effect } from 'effect'
import type { DomainError } from '../domain/errors'
import { runApp } from './runtime.server'

export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

export const act =
  <I, A>(useCase: (input: I) => Effect.Effect<A, DomainError, Parameters<typeof runApp>[0] extends Effect.Effect<any, any, infer R> ? R : never>) =>
  (input: I): Promise<ActionResult<A>> =>
    runApp(
      useCase(input).pipe(
        Effect.map((data): ActionResult<A> => ({ ok: true, data })),
        Effect.catchAll((e) => Effect.succeed<ActionResult<A>>({ ok: false, error: e.message })),
      ),
    )
