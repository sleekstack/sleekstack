/** @jsxImportSource @sleekstack/ui */
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { Effect, Schema } from 'effect'
import { useAtomValue, useSetAtom } from '@sleekstack/ui'

// A create form: no source, so `create` takes nothing and the call still passes `undefined`.
type TagForm = { readonly name: string }
const NewTag = {
  schema: () => Schema.Struct({ name: Schema.String.pipe(Schema.minLength(1, { message: () => 'Enter a name' })) }),
  create: () => ({ name: '' }),
  toDto: (d) => Effect.succeed({ name: d.name.trim() }),
} satisfies DraftSpec<TagForm, { readonly name: string }>

// A class-instance Draft: a `Date` has no fields, so it is written whole through `value`.
const DueDate = {
  schema: () => Schema.ValidDateFromSelf,
  create: (due: Date) => due,
  toDto: (d) => Effect.succeed({ due: d.toISOString() }),
} satisfies DraftSpec<Date, { readonly due: string }, Date>

export const NewTagForm = function* () {
  const draft = yield* useDraft(NewTag, undefined)
  const setName = yield* useSetAtom(draft.field('name'))
  const valid = yield* useAtomValue(draft.valid)
  return (
    <form>
      <input name="name" value={draft.field('name')} onInput={(e) => setName(e.currentTarget.value)} />
      <button type="submit" disabled={!valid}>
        Add
      </button>
    </form>
  )
}

export const DueDateInput = function* ({ due }: { due: Date }) {
  const draft = yield* useDraft(DueDate, due)
  const setDue = yield* useSetAtom(draft.value)
  return <input type="date" onInput={(e) => setDue(new Date(e.currentTarget.value))} />
}
