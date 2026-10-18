/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { Effect } from 'effect'
import { useSetAtom } from '@sleekstack/ui'

class Analytics extends Effect.Tag('Analytics')<Analytics, { track(event: string): Effect.Effect<void> }>() {}

const openAtom = Atom.make(false)
const trackHelp = Analytics.track('help')

export const Toolbar = function* () {
  const setOpen = yield* useSetAtom(openAtom)
  return (
    <nav>
      {/* A function that returns nothing: a plain setter. */}
      <button onClick={() => setOpen(true)}>Open</button>
      {/* A function that returns an Effect, run with the context captured at this element. */}
      <button onClick={(e) => Analytics.track(`save at ${e.clientX}`)}>Save</button>
      {/* A generator function, run as Effect.gen. */}
      <button
        onClick={function* () {
          yield* Analytics.track('share')
          setOpen(false)
        }}
      >
        Share
      </button>
      {/* An Effect value: run again on every click; it ignores the event. */}
      <button onClick={trackHelp}>Help</button>
    </nav>
  )
}
