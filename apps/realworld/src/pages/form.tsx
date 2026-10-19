/** @jsxImportSource @sleekstack/ui */
import { type Atom, Result } from '@sleekstack/core'
import { redirect } from '@sleekstack/router'
import { type ActionEvent, type BoundAction, type FormAction, Store } from '@sleekstack/ui'
import { Cause, Effect, Option } from 'effect'

/** The messages a failed submit shows: field errors as `<field> <message>`, anything else as one line. */
const messagesOf = (error: unknown): ReadonlyArray<string> => {
  const e = error as { _tag?: string; errors?: Readonly<Record<string, ReadonlyArray<string>>> } | undefined
  if ((e?._tag === 'ValidationError' || e?._tag === 'Forbidden') && e.errors)
    return Object.entries(e.errors).flatMap(([field, messages]) => messages.map((m) => `${field} ${m}`))
  if (e?._tag === 'Unauthorized') return ['Your session has ended: sign in again']
  return ['Something went wrong: try again']
}

/** What a `useAction` result shows under its form: nothing, or the messages of its failure. */
export const errorsOf = (outcome: Result.Result<unknown, unknown>): ReadonlyArray<string> =>
  Result.isFailure(outcome) ? messagesOf(Option.getOrUndefined(Cause.failureOption(outcome.cause))) : []

/**
 * The form `action` for a `useAction` pair: runs it and, once `result` is a success, navigates to `to(value)`, where the
 * next page's loaders run again. After a failure it stays, and the Draft keeps its edits.
 */
export const toPage =
  <A,>(result: Atom.Atom<Result.Result<A, unknown>>, run: BoundAction<any>, to: (value: A) => string): FormAction =>
  (event: ActionEvent) =>
    Effect.zipRight(
      run(event),
      Effect.flatMap(Store, (store) => {
        const outcome = store.get(result)
        return Result.isSuccess(outcome) ? redirect(to(outcome.value)) : Effect.void
      }),
    )

/** `toPage` to `/`, where the next page's loaders read the viewer again. */
export const toHome = (result: Atom.Atom<Result.Result<unknown, unknown>>, run: BoundAction<any>): FormAction =>
  toPage(result, run, () => '/')

export const ErrorList = ({ errors }: { errors: ReadonlyArray<string> }) =>
  errors.length > 0 ? (
    <ul class="error-messages">
      {errors.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  ) : (
    <></>
  )
