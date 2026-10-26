import { records } from '@sleekstack/start'
import { Effect } from 'effect'
import { Article } from '../../../article'

export default records(Article)

/** Another named export is an ordinary Controller Method. */
export const DELETE = (_: { readonly params: { readonly id: string } }) => Effect.void
