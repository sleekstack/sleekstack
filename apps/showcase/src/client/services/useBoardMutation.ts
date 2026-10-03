/**
 * apps/showcase/src/client/services/useBoardMutation.ts
 *
 * Runs a board mutation spec through TanStack's `useMutation`: cancel board reads and write the optimistic
 * patch in `onMutate`, restore the snapshot in `onError`, invalidate the board on settle.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BoardDto } from '../../models/task'
import { boardOptions, type BoardMutation } from './board-query'

export const useBoardMutation = <I>(spec: BoardMutation<I>) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: spec.mutationFn,
    onMutate: async (input: I) => {
      await client.cancelQueries({ queryKey: boardOptions.queryKey })
      const prev = client.getQueryData(boardOptions.queryKey)
      const next = spec.patch(input, prev ?? ([] as BoardDto))
      if (next) client.setQueryData(boardOptions.queryKey, next)
      return { prev }
    },
    onError: (_e, _input, ctx) => {
      if (ctx) client.setQueryData(boardOptions.queryKey, ctx.prev)
    },
    onSettled: () => client.invalidateQueries({ queryKey: boardOptions.queryKey }),
  })
}
