import { defineRecord, readOnly, type RecordAdapter, type RecordNotFound, type RecordRejected } from '@sleekstack/model'
import { Context, Schema } from 'effect'

type ArticleWire = { readonly id: string; readonly title: string; readonly createdAt: string }

// Client-safe: the browser gets a Layer generated from the Controller's route, the server a Layer File.
export class ArticleApi extends Context.Tag('ArticleApi')<
  ArticleApi,
  RecordAdapter<ArticleWire, Omit<ArticleWire, 'id' | 'createdAt'>, RecordNotFound | RecordRejected>
>() {}

export const Article = defineRecord('article', {
  fields: {
    id: Schema.String,
    title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
    // In the record and the wire form; never in the Draft, the PATCH body or `Article.change`.
    createdAt: readOnly(Schema.String),
  },
  adapter: ArticleApi,
})
