import { Effect } from 'effect'
import { ValidationError } from '../../../errors'

/** Fails with `can't be blank` for every field that is empty or whitespace; `fields` holds only the ones required. */
export const requireFields = (fields: Record<string, string | undefined>): Effect.Effect<void, ValidationError> => {
  const blank = Object.keys(fields).filter((k) => !fields[k]?.trim())
  return blank.length
    ? Effect.fail(new ValidationError({ errors: Object.fromEntries(blank.map((k) => [k, ["can't be blank"]])) }))
    : Effect.void
}
