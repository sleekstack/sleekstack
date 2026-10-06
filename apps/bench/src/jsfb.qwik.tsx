/** @jsxImportSource @builder.io/qwik */
// The Qwik side of `jsfb.bench.ts`, compiled by Qwik's optimizer in client-render mode (`render()` into a jsdom element).
// Qwik is built for server rendering and resumption; this measures only its client re-render of a table, which is not its design
// center. Clicks do not dispatch under client rendering in jsdom (they need qwikloader and a resumable container), so `click`
// applies the same selection and removal through the component's store, which is what its handlers do.
import { _waitUntilRendered, component$, render, useStore } from '@builder.io/qwik'
import { type App, type Row, tick } from './jsfb-shared'

interface State {
  rows: ReadonlyArray<Row>
  selected: number | undefined
}

let instances = 0

const Table = component$<{ id: string }>(({ id }) => {
  // Shallow: rows are replaced as whole arrays, so Qwik need not wrap every row object in a proxy.
  const state = useStore<State>({ rows: [], selected: undefined }, { deep: false })
  // The optimizer moves this body to its own module, so the test reaches the store through a global slot.
  ;(globalThis as Record<string, unknown>)[id] = state
  return (
    <table class="table table-hover table-striped test-data">
      <tbody>
        {state.rows.map((row) => (
          <tr key={row.id} class={state.selected === row.id ? 'danger' : ''}>
            <td class="col-md-1">{row.id}</td>
            <td class="col-md-4">
              <a onClick$={() => (state.selected = row.id)}>{row.label}</a>
            </td>
            <td class="col-md-1">
              <a onClick$={() => (state.rows = state.rows.filter((r) => r.id !== row.id))}>
                <span class="glyphicon glyphicon-remove" aria-hidden="true" />
              </a>
            </td>
            <td class="col-md-6" />
          </tr>
        ))}
      </tbody>
    </table>
  )
})

export const qwikApp = async (): Promise<App> => {
  // Qwik asserts that its container is connected to the document; `dispose` detaches it again so a big attached table
  // does not slow the other libraries' tables (jsdom cost grows with the document).
  const container = document.createElement('div')
  document.body.appendChild(container)
  const id = `__qwikJsfb${instances++}`
  await render(container, <Table id={id} />)
  const state = (globalThis as Record<string, unknown>)[id] as State
  let current: ReadonlyArray<Row> = []
  // Qwik schedules its render on a timer after the write; wait for that turn, then for the render itself.
  const rendered = async () => (await tick(), void (await _waitUntilRendered(container)))
  return {
    container,
    dispose: () => container.remove(),
    set: async (rows) => {
      current = rows
      state.rows = rows
      await rendered()
    },
    get: () => current,
    click: async (i, cell) => {
      const row = current[i]!
      if (cell === 2) state.selected = row.id
      else state.rows = current = current.filter((r) => r.id !== row.id)
      await rendered()
    },
  }
}
