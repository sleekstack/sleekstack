/** @jsxImportSource @sleekstack/ui */
import { Result } from '@sleekstack/core'
import { useRecord } from '@sleekstack/model'
import { useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Option } from 'effect'
import { Book } from './records'

export const BookPage = function* ({ id }: { id: string }) {
  // The book from the identity map; fetched with `Book.find` only while the map has none.
  const book = yield* useRecord(Book, id)
  // Follows the book and the author in the map; never fetches.
  const author = yield* useAtomValue(Book.related(id, 'author'))
  const name = Option.flatMap(author, (a) => (a === null ? Option.none() : a.value))
  return Result.match(book, {
    onInitial: () => <p>Loading</p>,
    onSuccess: ({ value }) => (
      <article>
        <h1>{value.title}</h1>
        <p>by {Option.match(name, { onNone: () => 'unknown', onSome: (a) => a.name })}</p>
        <EditBook id={id} />
      </article>
    ),
    onFailure: () => <p role="alert">Could not load the book</p>,
  })
}

export const EditBook = function* ({ id }: { id: string }) {
  // The derived Draft: every field but `id` in its input form, seeded from the record in the map.
  const draft = yield* Book.useDraft(id)
  const setTitle = yield* useSetAtom(draft.field('title'))
  const setPrice = yield* useSetAtom(draft.field('price'))
  const [result, action] = yield* useAction(function* () {
    // Validates, serializes, saves through BookApi and writes the acknowledged book into the map.
    yield* Book.commit(id, draft)
  })
  const { pending } = yield* useFormStatus(result)
  const dirty = yield* useAtomValue(draft.dirty)
  return (
    <form action={action}>
      <input name="title" value={draft.field('title')} onInput={(e) => setTitle(e.currentTarget.value)} />
      <input name="price" value={draft.field('price')} onInput={(e) => setPrice(e.currentTarget.value)} />
      <button type="submit" disabled={pending || !dirty}>
        Save
      </button>
    </form>
  )
}
