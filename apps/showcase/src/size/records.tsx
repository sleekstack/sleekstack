/** @jsxImportSource @sleekstack/ui */
import { Result } from '@sleekstack/core'
import { defineRecord, type RecordAdapter, useRecord } from '@sleekstack/model'
import { mount, useAtom } from '@sleekstack/ui'
import { Effect, Layer, Schema } from 'effect'

type PostWire = { readonly id: string; readonly title: string }
class PostApi extends Effect.Tag('PostApi')<PostApi, RecordAdapter<PostWire, PostWire>>() {}

const Post = defineRecord('post', { fields: { id: Schema.String, title: Schema.String }, adapter: PostApi })

const PostApiLive = Layer.succeed(PostApi, {
  find: (id) => Effect.succeed({ id, title: 'Hello' }),
  save: (_, change) => Effect.succeed(change),
})

const EditPost = function* () {
  const post = yield* useRecord(Post, '1')
  const draft = yield* Post.useDraft('1')
  const [input, set] = yield* useAtom(draft.value)
  return Result.isSuccess(post) ? (
    <input value={input.title} onInput={(e) => set({ ...input, title: e.currentTarget.value })} />
  ) : (
    <p>Loading</p>
  )
}

/** Size budget entry (ADR 0022): a `mount` app reading and editing one record, the cost of opting in to records. */
export const mountRecords = (container: Element) => mount(<EditPost />, { layer: PostApiLive, container })
