import { records } from '@sleekstack/start'
import { Effect } from 'effect'
import { Article } from '../../../article'

export default records(Article)

export const GET = () => Effect.void // @error RecordsMethodCollision
