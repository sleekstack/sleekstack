/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { useRef, useSetAtom } from '@sleekstack/ui'

const sizeAtom = Atom.make(3)

/**
 * Host elements are typed per tag (ADR 0031): `<meter>` takes `min`, `max` and `value`, `onInput`'s `currentTarget` is the
 * `<input>`, and `ref` takes only a `Ref<HTMLInputElement>`. An atom as a value binds in place: this component never re-runs.
 */
export const TypedDomDemo = function* () {
  const setSize = yield* useSetAtom(sizeAtom)
  const note = yield* useRef<HTMLInputElement>()
  return (
    <section className="demo dom">
      <h2>Typed host elements</h2>
      <label>
        Size{' '}
        <input
          className="size"
          type="range"
          min={1}
          max={5}
          value={sizeAtom}
          onInput={(e) => setSize(e.currentTarget.valueAsNumber)}
        />
      </label>
      <meter min={1} max={5} value={sizeAtom} />
      <p>
        <input ref={note} className="note" placeholder="A note" />
        <button type="button" className="focus" onClick={() => note.current!.focus()}>
          Focus the note
        </button>
      </p>
    </section>
  )
}
