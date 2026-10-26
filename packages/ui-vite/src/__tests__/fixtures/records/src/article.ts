import { defineRecord, type RecordAdapter } from '@sleekstack/model'
import { Context, Schema } from 'effect'

type Wire = { readonly id: string; readonly title: string }
/** Client-safe: the browser gets the generated HTTP Layer, the server the Layer File. */
export class ArticleAdapter extends Context.Tag('ArticleAdapter')<ArticleAdapter, RecordAdapter<Wire>>() {}

export const Article = defineRecord('Article', {
  fields: { id: Schema.String, title: Schema.String },
  adapter: ArticleAdapter,
})
