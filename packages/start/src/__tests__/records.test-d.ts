import { Context, Effect, Schema } from 'effect'
import { records, recordsMethods } from '../index'

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const same = <A, B>(_: Same<A, B>) => {}

type Wire = { readonly id: string; readonly title: string }
class Articles extends Context.Tag('Articles')<
  Articles,
  {
    readonly find: (id: string) => Effect.Effect<Wire>
    readonly save: (id: string, change: { readonly title: string }) => Effect.Effect<Wire>
  }
>() {}
class Clock extends Context.Tag('Clock')<Clock, { readonly now: string }>() {}

const fields = { id: Schema.String, title: Schema.String }
const change = Schema.Struct({ title: Schema.String })
const Article = { type: 'article', schema: Schema.Struct(fields), change, adapter: Articles }

// The handler needs the adapter Tag and nothing else: no `Store`.
const { GET, PATCH } = recordsMethods(records(Article))
same<Effect.Effect.Context<ReturnType<typeof GET.run>>, Articles>(true)
same<Effect.Effect.Context<ReturnType<typeof PATCH.run>>, Articles>(true)

// @ts-expect-error a record with no adapter cannot be served
records({ type: 'article', schema: Schema.Struct(fields), change })

const NeedsClock = Schema.String.pipe(
  Schema.transformOrFail(Schema.String, { decode: (s) => Effect.as(Clock, s), encode: Effect.succeed }),
)
// @ts-expect-error a record whose Schemas need a Service cannot be served
records({ ...Article, schema: Schema.Struct({ ...fields, at: NeedsClock }) })

class Other extends Context.Tag('Other')<Other, { readonly find: number }>() {}
// @ts-expect-error the adapter Tag must be a record adapter's
records({ ...Article, adapter: Other })
