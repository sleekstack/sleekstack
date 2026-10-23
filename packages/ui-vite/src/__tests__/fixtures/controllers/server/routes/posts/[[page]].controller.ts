import { Effect } from 'effect'

export const GET = (_: { params: { page?: string } }) => Effect.succeed('posts')
