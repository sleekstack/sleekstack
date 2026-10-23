import { Effect } from 'effect'

export const GET = (_: { params: { id: string } }) => Effect.succeed('user')
