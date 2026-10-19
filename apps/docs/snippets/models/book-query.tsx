/** @jsxImportSource @sleekstack/ui */
import { makeAtomStore, Result } from '@sleekstack/core'
import { useRecord } from '@sleekstack/model'
import { queryOf } from '@sleekstack/model/query'
import { QueryClientLive } from '@sleekstack/query'
import { Store } from '@sleekstack/ui'
import { Layer } from 'effect'
import { Book, BookRest } from './records'

// The query function runs with the Query Client Layer's services: give it the app's Store and the adapter Layer.
export const store = makeAtomStore()
export const AppLayer = QueryClientLive().pipe(Layer.provideMerge(Layer.merge(Layer.succeed(Store, store), BookRest)))

const BookQuery = queryOf(Book)

export const BookTitle = function* ({ id }: { id: string }) {
  // Same Result states as the default fetch; the fetch goes through the Query Client with key ['book', id].
  const book = yield* useRecord(Book, id, { via: BookQuery })
  return Result.match(book, {
    onInitial: () => <p>Loading</p>,
    onSuccess: ({ value }) => <h1>{value.title}</h1>,
    onFailure: () => <p role="alert">Could not load the book</p>,
  })
}

// Outside a component: a cached read that also writes the book into the map.
export const prefetch = (id: string) => BookQuery.query(id)
