import { Effect } from 'effect'
import { NotFound } from '../../../src/errors'

/** An unknown `/api/` path: the JSON 404. Any other method here is `MethodNotAllowed`, which `wrap` answers alike. */
export const GET = (_input: { readonly params: { readonly rest: string } }) =>
  Effect.fail(new NotFound({ resource: 'body' }))
