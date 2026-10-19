import { Effect } from 'effect'

/** Not `@sleekstack/model`'s hook: takes no slot, so a conditional call is fine. */
export const useDraft = (_spec: unknown, _src: unknown) => Effect.void
