import type { NotFound, Redirect } from '@sleekstack/router'
import type { ActionEvent } from '@sleekstack/ui'
import { Data, Effect, Layer, ParseResult, Schema } from 'effect'
import type { ErrorOf, ServerFn } from './serverFn'
import type { ServerServiceEntry, ServerServiceMethodSchemas } from './service'
import { DecodeError, decodeResult, prefix } from './wire'

export { DecodeError } from './wire'
export { recordAdapterLayer } from './recordsClient'
export type { ServedRecordRef } from './recordsClient'
export { ServerService, taggedError } from './service'
export type {
  ServerServiceEntry,
  ServerServiceEntryOf,
  ServerServiceMethodSchemas,
  ServerServiceShape,
} from './service'

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

type Call<C extends Contract> = Effect.Effect<
  Schema.Schema.Type<C['success']>,
  ErrorOf<C['error']> | NetworkError | DecodeError | Redirect | NotFound
>

/**
 * A client stub: calling it posts the input and reads the result back as an Effect. Given a form's `ActionEvent`
 * instead, it decodes the input from `formData` with the input Schema, so it is a form `action` as it stands.
 */
export interface Stub<C extends Contract> {
  (input: Schema.Schema.Type<C['input']>): Call<C>
  (event: ActionEvent): Call<C>
}

const isActionEvent = (arg: unknown): arg is ActionEvent =>
  typeof FormData !== 'undefined' && (arg as Partial<ActionEvent> | null)?.formData instanceof FormData

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
 * ```tsx
 * import { client } from '@sleekstack/start/client'
 * import { Effect, Schema } from 'effect'
 *
 * const rename = client({
 *   id: 'profile.rename',
 *   input: Schema.Struct({ name: Schema.NonEmptyString }),
 *   success: Schema.Struct({ name: Schema.String }),
 * })
 *
 * export const call = Effect.gen(function* () {
 *   return yield* rename({ name: 'Ada' })
 * })
 * export const form = <form action={rename}>...</form>
 * ```
 */
export const client = <C extends Contract>(contract: C): Stub<C> =>
  ((arg: unknown) =>
    Effect.gen(function* () {
      const asDecodeError = (e: ParseResult.ParseError) => new DecodeError({ issues: issues(e) })
      // ponytail: a repeated form field keeps its last value; decode `getAll` per field if a contract needs arrays.
      const input = isActionEvent(arg)
        ? yield* Effect.mapError(Schema.decodeUnknown(contract.input)(Object.fromEntries(arg.formData)), asDecodeError)
        : arg
      const encoded = yield* Effect.mapError(Schema.encode(contract.input)(input), asDecodeError)
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
    })) as Stub<C>

/**
 * The browser side of a Server Service: a Layer providing its Tag, each method a `client` stub posting to
 * `/_sleek/fn/<Tag id>.<method>`. The generated `virtual:sleek/server` module merges these with `serverClients`.
 */
export const serverClient = <Id, Service>(entry: ServerServiceEntry<Id, Service>): Layer.Layer<Id> => {
  const methods = Object.fromEntries(
    Object.entries(entry.methods).map(([name, schemas]) => [
      name,
      client({ id: `${entry.tag.key}.${name}`, ...(schemas as ServerServiceMethodSchemas) }),
    ]),
  )
  return Layer.succeed(entry.tag, methods as Service)
}

type TagOf<E> = E extends ServerServiceEntry<infer Id, any> ? Id : never

/** Every entry's `serverClient` in one Layer, providing exactly the entries' Tags. */
export const serverClients = <const Entries extends ReadonlyArray<ServerServiceEntry>>(
  entries: Entries,
): Layer.Layer<TagOf<Entries[number]>> =>
  entries.reduce((layer, entry) => Layer.merge(layer, serverClient(entry)), Layer.empty as Layer.Layer<any>)
