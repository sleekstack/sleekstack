/** @jsxImportSource @sleekstack/ui */
import { Effect, Schema } from 'effect'
import { useAction, useAtomValue, useFormStatus } from '@sleekstack/ui'

class Tasks extends Effect.Tag('Tasks')<Tasks, { add(title: string): Effect.Effect<void> }>() {}

// The form's fields, decoded from FormData. A blank title fails with a ParseError.
const NewTask = Schema.Struct({ title: Schema.Trim.pipe(Schema.nonEmptyString()) })

export const TaskForm = function* () {
  // `action` goes on the form; `result` is a Result atom of the latest submit.
  const [result, action] = yield* useAction(function* (e) {
    const { title } = yield* Schema.decodeUnknown(NewTask)(Object.fromEntries(e.formData))
    yield* Tasks.add(title)
  })
  const { pending } = yield* useFormStatus(result)
  const outcome = yield* useAtomValue(result)
  return (
    <form action={action}>
      <input name="title" />
      <button type="submit" disabled={pending}>
        Add
      </button>
      {outcome._tag === 'Failure' && <p role="alert">A task needs a title</p>}
    </form>
  )
}
