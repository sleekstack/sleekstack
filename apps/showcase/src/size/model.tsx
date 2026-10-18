/** @jsxImportSource @sleekstack/ui */
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { mount, useAtom } from '@sleekstack/ui'
import { Effect, Layer, Schema } from 'effect'

const NameDraft = {
  schema: () => Schema.String,
  create: (name) => name,
  toDto: (name) => Effect.succeed({ name }),
} satisfies DraftSpec<string, { readonly name: string }, string>

const EditName = function* () {
  const draft = yield* useDraft(NameDraft, 'Ada')
  const [name, set] = yield* useAtom(draft.value)
  return <input value={name} onInput={(e) => set(e.currentTarget.value)} />
}

/** Size budget entry (ADR 0022): a `mount` app with one Draft, the cost of opting in to `@sleekstack/model`. */
export const mountDraft = (container: Element) => mount(<EditName />, { layer: Layer.empty, container })
