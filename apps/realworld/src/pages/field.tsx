/** @jsxImportSource @sleekstack/ui */
import type { Atom } from '@sleekstack/core'
import { useSetAtom } from '@sleekstack/ui'

/** A text input bound to a Draft field. */
export const Field = function* ({
  value,
  placeholder,
  type = 'text',
}: {
  value: Atom.Writable<string>
  placeholder: string
  type?: 'text' | 'email' | 'password'
}) {
  const set = yield* useSetAtom(value)
  return (
    <fieldset class="form-group">
      <input
        class="form-control form-control-lg"
        type={type}
        placeholder={placeholder}
        value={value}
        onInput={(e) => set(e.currentTarget.value)}
      />
    </fieldset>
  )
}
