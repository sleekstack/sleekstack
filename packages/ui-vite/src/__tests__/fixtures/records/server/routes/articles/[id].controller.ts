import { records } from '@sleekstack/start'
import { Effect } from 'effect'
import { Article } from '../../../src/article'

export default records(Article)

/** A named export beside the served record is an ordinary Controller Method. */
export const DELETE = ({ params }: { readonly params: { readonly id: string } }) => Effect.succeed(`deleted ${params.id}`)
