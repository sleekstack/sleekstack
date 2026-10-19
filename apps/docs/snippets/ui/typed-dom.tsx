/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { useRef, useSetAtom } from '@sleekstack/ui'

const sizeAtom = Atom.make(3)

export const Settings = function* () {
  const setSize = yield* useSetAtom(sizeAtom)
  // Typed with its element: this Ref fits only an <input ref>.
  const note = yield* useRef<HTMLInputElement>()
  return (
    <form class="settings">
      <label for="size">Size</label>
      {/* `currentTarget` is the <input>. An atom as a value binds the attribute: no re-run on change. */}
      <input
        id="size"
        type="range"
        min={1}
        max={5}
        value={sizeAtom}
        onInput={(e) => setSize(e.currentTarget.valueAsNumber)}
      />
      <meter min={1} max={5} value={sizeAtom} aria-label="Size" />
      <input ref={note} data-field="note" placeholder="A note" />
      <button type="button" onPointerDown={() => note.current?.focus()}>
        Focus the note
      </button>
      <svg viewBox="0 0 10 10" width={20} height={20}>
        <circle cx={5} cy={5} r={4} />
      </svg>
      {/* A custom element (a hyphenated tag) takes any props. */}
      <color-swatch hue={210} />
    </form>
  )
}

// Each line below is a tsc error.
// @ts-expect-error: `hreff` is not an attribute of <a>.
export const Typo = () => <a hreff="/docs">Docs</a>
// @ts-expect-error: `class` and `className` together.
export const Both = () => <p class="a" className="b" />
// @ts-expect-error: a string is not an event handler.
export const Inline = () => <button onClick="alert(1)">Go</button>
// @ts-expect-error: an object is not an attribute value.
export const Meter = () => <meter value={{ n: 1 }} />
