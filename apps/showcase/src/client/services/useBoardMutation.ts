/**
 * apps/showcase/src/client/services/useBoardMutation.ts
 *
 * The board components' mutation hook (kept apart from board-query.ts, which the server page also imports).
 */
import type { Mutation } from '@sleekstack/query'
import { useMutation, type UseMutation } from '@sleekstack/react'

const serverMutation: UseMutation<any, any, any> = {
  mutate: () => Promise.reject(new Error('mutate during a server render')),
  state: { _tag: 'idle' },
  isPending: false,
  reset: () => {},
}

/**
 * `useMutation` that also renders on the server, as idle (the core hook throws `AtomsClientOnly` there). The branch
 * is fixed per environment, so the hook order never changes within one.
 * ponytail: app-level shim; move it into `useMutation` if more apps need server-rendered forms.
 */
export const useBoardMutation = <I, A, E, R>(m: Mutation.Mutation<I, A, E, R>): UseMutation<I, A, E> =>
  typeof window === 'undefined' ? serverMutation : useMutation(m)
