import { type Context, Effect, Schema } from 'effect'
import type { ControllerMethodEntry } from './app'

/** The adapter Service of a served record: `RecordAdapter` of `@sleekstack/model`, read structurally. */
interface ServedAdapter {
  readonly find: (id: string) => Effect.Effect<any, any>
  readonly save: (id: string, change: any) => Effect.Effect<any, any>
}

/** What `records` serves: a record type with an adapter, as `defineRecord(type, { fields, adapter })` makes it. */
export interface ServableRecord {
  readonly type: string
  /** The fields' Schema; one that needs a Service cannot be served, as the Controller decodes and encodes with none. */
  readonly schema: Schema.Schema<any, any, never>
  readonly change: Schema.Schema<any, any, never>
  readonly adapter: Context.Tag<any, any>
}

declare const RecordsTypeId: unique symbol

/** The default export of a served record's Controller file: the record, served by `GET` and `PATCH` of its route. */
export interface Records<R extends ServableRecord> {
  readonly [RecordsTypeId]: typeof RecordsTypeId
  readonly record: R
}

/**
 * `export default records(Article)` in a `[id].controller.ts`: serves the record over its route (ADR 0057). `GET`
 * answers the adapter's `find(id)` and `PATCH` decodes the body with `record.change` and answers the adapter's
 * `save(id, change)`, each as the record's wire form, as JSON. A `RecordNotFound` answers 404 and a `RecordRejected` 422,
 * each with its fields as the JSON body; any other failure reaches `wrap`. The adapter Tag is called directly, so the
 * record needs an `adapter`, and its fields' Schemas must need no Service (the Controller decodes and encodes with none).
 *
 * @example
 * ```ts
 * import { records } from '@sleekstack/start'
 * import { Article } from '../../src/records/article'
 *
 * export default records(Article)
 * ```
 */
export const records = <R extends ServableRecord>(
  record: R & (Context.Tag.Service<R['adapter']> extends ServedAdapter ? unknown : never),
): Records<R> => ({ record }) as unknown as Records<R>

const params = Schema.Struct({ id: Schema.String })

const failures: Readonly<Record<string, readonly [status: number, fields: ReadonlyArray<string>]>> = {
  RecordNotFound: [404, ['type', 'id']],
  RecordRejected: [422, ['type', 'id', 'message']],
}

/** A `RecordNotFound` or `RecordRejected` as its answer; any other failure stays one. */
const answerFailure = (e: unknown): Effect.Effect<Response, unknown> => {
  const tag = (e as { readonly _tag?: unknown } | null)?._tag
  const failure = typeof tag === 'string' ? failures[tag] : undefined
  if (!failure) return Effect.fail(e)
  const [status, fields] = failure
  const body = Object.fromEntries([['_tag', tag], ...fields.map((k) => [k, (e as Record<string, unknown>)[k]])])
  return Effect.succeed(Response.json(body, { status }))
}

/** A served record's Controller Method: its `run` needs the adapter Tag and nothing else. */
export interface RecordsMethodEntry<R extends ServableRecord> extends ControllerMethodEntry {
  readonly run: (input: any) => Effect.Effect<unknown, unknown, Context.Tag.Identifier<R['adapter']>>
}

/**
 * The `GET` and `PATCH` Controller Method entries of `records(record)`, for the generated Controller entry. The
 * answer encodes through the record's wire form (its fields' Encoded side): a value that does not is a defect.
 */
export const recordsMethods = <R extends ServableRecord>({
  record,
}: Records<R>): { readonly GET: RecordsMethodEntry<R>; readonly PATCH: RecordsMethodEntry<R> } => {
  const success = Schema.encodedBoundSchema(record.schema)
  return {
    GET: {
      params,
      success,
      run: ({ params }) =>
        Effect.catchAll(
          Effect.flatMap(record.adapter, (a: ServedAdapter) => a.find(params.id)),
          answerFailure,
        ),
    },
    PATCH: {
      params,
      body: record.change,
      success,
      run: ({ params, body }) =>
        Effect.catchAll(
          Effect.flatMap(record.adapter, (a: ServedAdapter) => a.save(params.id, body)),
          answerFailure,
        ),
    },
  }
}
