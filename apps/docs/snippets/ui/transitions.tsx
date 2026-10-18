/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { Effect } from 'effect'
import { Pending, startTransition, useAtom, useAtomValue, useDeferredAtom, useSetAtom } from '@sleekstack/ui'

const tabAtom = Atom.make('Overview')

const TabContent = function* ({ tab }: { tab: string }) {
  yield* Effect.sleep('300 millis') // a round trip
  return <p>{tab} loaded</p>
}

export const Tabs = function* () {
  const tab = yield* useAtomValue(tabAtom)
  const setTab = yield* useSetAtom(tabAtom)
  return (
    <div>
      {/* Marked: the open tab stays on screen until the new one has loaded. */}
      <button onClick={() => startTransition(() => setTab('Activity'))}>Activity</button>
      {/* Unmarked: the new tab's fallback shows at once. */}
      <button onClick={() => setTab('Members')}>Members</button>
      {/* A new key is a new Pending with no content yet. */}
      <Pending key={tab} fallback={<p>Loading {tab}</p>}>
        <TabContent tab={tab} />
      </Pending>
    </div>
  )
}

const ROWS = Array.from({ length: 1000 }, (_, i) => `Row ${i + 1}`)
const queryAtom = Atom.make('')

// The slow component reads the deferred copy, so it re-runs one commit after the input.
const Matches = function* ({ query }: { query: Atom.Atom<string> }) {
  const q = yield* useAtomValue(query)
  return (
    <ul>
      {ROWS.filter((r) => r.includes(q)).map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  )
}

export const Search = function* () {
  const deferred = yield* useDeferredAtom(queryAtom)
  const [query, setQuery] = yield* useAtom(queryAtom)
  return (
    <div>
      <input value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      <Matches query={deferred} />
    </div>
  )
}
