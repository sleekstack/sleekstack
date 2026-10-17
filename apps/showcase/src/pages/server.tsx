/** @jsxImportSource @sleekstack/ui */
import { client } from '@sleekstack/start/client'
import { useAction, useAtomValue, useFormStatus } from '@sleekstack/ui'
import { Cause, Option } from 'effect'
import { addItem } from './items'

/** Posts to `/_sleek/fn/items.add`, which the dev server answers through `server/app.ts`. */
const add = client(addItem)

/** A form whose action is the server function's stub: the list comes back from the server, a failure arrives typed. */
const ItemsForm = function* () {
  const [result, submit] = yield* useAction(add)
  const { pending } = yield* useFormStatus(result)
  const outcome = yield* useAtomValue(result)
  const items =
    outcome._tag === 'Success'
      ? outcome.value
      : outcome._tag === 'Failure'
        ? Option.getOrElse(outcome.previousValue, () => [])
        : []
  const error = outcome._tag === 'Failure' ? Option.getOrUndefined(Cause.failureOption(outcome.cause)) : undefined
  return (
    <>
      <form className="items" action={submit}>
        <input className="title" name="title" />
        <button type="submit" className="add" disabled={pending}>
          {pending ? 'Adding' : 'Add'}
        </button>
      </form>
      {error && (
        <p className="error">
          {error._tag === 'DuplicateItem'
            ? `${error.title} is on the list already`
            : error._tag === 'DecodeError'
              ? 'Enter a title'
              : 'Not added: the server did not answer'}
        </p>
      )}
      <ul className="list">
        {items.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </>
  )
}

export const ServerFnDemo = () => (
  <section className="demo server">
    <h2>Server function</h2>
    <ItemsForm />
  </section>
)
