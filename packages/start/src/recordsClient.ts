import { RecordNotFound, RecordRejected } from '@sleekstack/model'
import { type Context, Effect, Layer } from 'effect'

/** What `recordAdapterLayer` reads of a record type: its type name and its adapter Tag. */
export interface ServedRecordRef {
  readonly type: string
  readonly adapter: Context.Tag<any, any>
}

const isObject = (body: unknown): body is Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)

/**
 * The browser side of a served record (ADR 0057): a Layer providing the record's adapter Tag over HTTP, `find` calling
 * `GET` and `save` calling `PATCH` of `pattern` (the Controller's route, `/articles/:id`) with the id as one encoded
 * segment. 404 fails with `RecordNotFound`, 400 and 422 with `RecordRejected` (the body's `message`, else the status
 * text); any other status, a failed `fetch`, or a body that is not a JSON object is a defect. The generated
 * `virtual:sleek/server` module calls it for every served record.
 */
export const recordAdapterLayer = <R extends ServedRecordRef>(
  record: R,
  pattern: string,
): Layer.Layer<Context.Tag.Identifier<R['adapter']>> => {
  const call = (id: string, init: RequestInit) =>
    Effect.flatMap(
      Effect.promise(async (signal) => {
        const res = await fetch(pattern.replace(':id', encodeURIComponent(id)), { ...init, signal })
        const text = await res.text()
        let body: unknown
        try {
          body = JSON.parse(text)
        } catch {
          body = undefined
        }
        return { res, body }
      }),
      ({ res, body }): Effect.Effect<Record<string, unknown>, RecordNotFound | RecordRejected> => {
        if (res.ok && isObject(body)) return Effect.succeed(body)
        if (res.status === 404) return Effect.fail(new RecordNotFound({ type: record.type, id }))
        if (res.status === 400 || res.status === 422) {
          const message = isObject(body) && typeof body.message === 'string' ? body.message : res.statusText
          return Effect.fail(new RecordRejected({ type: record.type, id, message }))
        }
        return Effect.dieMessage(`${init.method} ${res.url || pattern} of '${record.type}' answered ${res.status}`)
      },
    )
  return Layer.succeed(record.adapter, {
    find: (id: string) => call(id, { method: 'GET' }),
    save: (id: string, change: unknown) =>
      call(id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change) }),
  })
}
