import type { NotFound, Redirect } from '@sleekstack/router'
import { Data, Effect, ParseResult, Schema } from 'effect'
import type { ErrorOf, ServerFn } from './serverFn'
import { DecodeError, decodeResult, prefix } from './wire'

export { DecodeError } from './wire'

type AnySchema = Schema.Schema<any, any, never>

/**
 * The client-safe half of a server function: its id and Schemas, no body. Declare it where the browser may import it
 * and build the server function from it, `serverFn(contract.id, contract)(function* ...)`, so the client imports the
 * Schemas and never the server module.
 */
export interface Contract {
  readonly id: string
  readonly input: AnySchema
  readonly success: AnySchema
  readonly error?: AnySchema | undefined
}

/** The call got no function result: `fetch` failed (`cause`), or the server answered `status` with no envelope. */
export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly status?: number
  readonly cause?: unknown
}> {}

/** A client stub: calling it posts the input and reads the result back as an Effect. */
export type Stub<C extends Contract> = (
  input: Schema.Schema.Type<C['input']>,
) => Effect.Effect<
  Schema.Schema.Type<C['success']>,
  ErrorOf<C['error']> | NetworkError | DecodeError | Redirect | NotFound
>

const issues = (error: ParseResult.ParseError) =>
  ParseResult.ArrayFormatter.formatErrorSync(error).map((i) => ({
    path: i.path.map((p) => (typeof p === 'number' ? p : String(p))),
    message: i.message,
  }))

/**
 * The browser side of a server function: an Effect-returning stub typed from its contract (or the server function
 * itself, which carries the same fields). It fails with the declared error, the router's `Redirect` / `NotFound` (so a
 * router form action navigates), `NetworkError`, or `DecodeError` for input or a response that does not match its
 * Schema.
 *
 * @example
 * ```ts
 * const rename = client(contracts.rename)
 * const action = function* (e: ActionEvent) {
 *   return yield* rename(yield* Schema.decodeUnknown(contracts.rename.input)(Object.fromEntries(e.formData)))
 * }
 * ```
 */
export const client =
  <C extends Contract>(contract: C): Stub<C> =>
  (input) =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encode(contract.input)(input).pipe(
        Effect.mapError((e) => new DecodeError({ issues: issues(e) })),
      )
      const response = yield* Effect.tryPromise({
        try: async (signal) => {
          const res = await fetch(prefix + contract.id, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // A `Schema.Void` input has no JSON form; the server reads an empty body as `undefined`.
            body: encoded === undefined ? undefined : JSON.stringify(encoded),
            signal,
          })
          return { status: res.status, ok: res.ok, text: await res.text() }
        },
        catch: (cause) => new NetworkError({ cause }),
      })
      let body: unknown
      try {
        body = JSON.parse(response.text)
      } catch {
        return yield* response.ok
          ? new DecodeError({ issues: [{ path: [], message: 'Malformed JSON' }] })
          : new NetworkError({ status: response.status })
      }
      return yield* decodeResult(contract as unknown as ServerFn<string, C['input'], C['success'], C['error']>, body)
    })
