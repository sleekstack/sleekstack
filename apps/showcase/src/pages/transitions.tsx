/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { Effect } from 'effect'
import { Pending, startTransition, useAtom, useAtomValue, useDeferredAtom, useLocal, useSetAtom } from '@sleekstack/ui'

const TABS = ['Overview', 'Activity', 'Members'] as const
type Tab = (typeof TABS)[number]
const tabAtom = Atom.make<Tab>('Overview')

/** A tab's content, after a simulated round trip. */
const TabContent = function* ({ tab }: { tab: Tab }) {
  yield* Effect.sleep('300 millis')
  return <p className="tab-content">{tab} loaded</p>
}

/** Each tab is a new `Pending` key. Opened in a transition, the old tab stays until the new one has loaded. */
const Tabs = function* () {
  const tab = yield* useAtomValue(tabAtom)
  const setTab = yield* useSetAtom(tabAtom)
  const [smooth, setSmooth] = yield* useLocal(true)
  const open = (next: Tab) => (smooth ? startTransition(() => setTab(next)) : setTab(next))
  return (
    <div className="tabs">
      <label>
        <input
          type="checkbox"
          className="smooth"
          checked={smooth}
          onChange={(e) => setSmooth(e.currentTarget.checked)}
        />{' '}
        startTransition
      </label>
      <nav className="row">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={t === tab ? 'tab current' : 'tab'}
            data-tab={t}
            onClick={() => open(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <Pending key={tab} fallback={<p className="muted">Loading {tab}</p>}>
        <TabContent tab={tab} />
      </Pending>
    </div>
  )
}

const ROWS = Array.from({ length: 1000 }, (_, i) => `Row ${i + 1}`)
const queryAtom = Atom.make('')

/** The slow view: reads the deferred query, so it re-runs one commit after the input. */
const Matches = function* ({ query }: { query: Atom.Atom<string> }) {
  const q = yield* useAtomValue(query)
  const hits = ROWS.filter((r) => r.includes(q))
  return (
    <div className="matches">
      <p className="count">
        {hits.length} rows match "{q}"
      </p>
      <ul>
        {hits.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  )
}

/** Cheap: re-runs on every keystroke and commits before `Matches` re-runs. */
const Search = function* () {
  const [query, setQuery] = yield* useAtom(queryAtom)
  const deferred = yield* useDeferredAtom(queryAtom)
  return (
    <div className="search">
      <input className="query" placeholder="Filter rows" onInput={(e) => setQuery(e.currentTarget.value)} />
      <p className="typed">Typed "{query}"</p>
      <Matches query={deferred} />
    </div>
  )
}

export const TransitionsDemo = () => (
  <section className="demo transitions">
    <h2>startTransition and useDeferredAtom</h2>
    <Tabs />
    <Search />
  </section>
)
