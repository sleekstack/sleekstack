import { Effect } from 'effect'
import { NoteLocked, Viewer } from '../../../../src/notes'

export const PUT = (input: {
  readonly params: { readonly id: number }
  readonly body: { readonly text: string }
}): Effect.Effect<string, NoteLocked, Viewer> =>
  Effect.flatMap(Viewer, (viewer) =>
    viewer === 'ann'
      ? Effect.succeed(`${viewer}:${input.params.id}:${input.body.text}`)
      : Effect.fail(new NoteLocked({ id: input.params.id })),
  )
