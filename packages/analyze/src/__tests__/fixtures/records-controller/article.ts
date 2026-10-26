import { defineRecord, type RecordAdapter } from '@sleekstack/model'
import { Context, Schema } from 'effect'

type Wire = { readonly id: string; readonly title: string }
export class ArticleAdapter extends Context.Tag('ArticleAdapter')<ArticleAdapter, RecordAdapter<Wire>>() {}
class Lookup extends Context.Tag('Lookup')<Lookup, { readonly title: string }>() {}
declare const NeedsLookup: Schema.Schema<string, string, Lookup>

export const Article = defineRecord('Article', {
  fields: { id: Schema.String, title: Schema.String },
  adapter: ArticleAdapter,
})
export const Note = defineRecord('Note', { fields: { id: Schema.String } })
export const Needy = defineRecord('Needy', {
  fields: { id: Schema.String, title: NeedsLookup },
  adapter: ArticleAdapter,
})
export const notARecord = { type: 'Article' }
