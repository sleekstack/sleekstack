/** @jsxImportSource solid-js */
// The Solid side of `jsfb.bench.ts`, compiled by vite-plugin-solid (real Solid output: cloned templates, fine-grained updates).
// Rows are written as immutable data and applied with `reconcile` keyed by id, Solid's idiom for data that arrives as a new array;
// the selection uses `createSelector`, as in the reference implementation. Clicks use `on:click` (a listener on the element) instead of
// the default delegation to `document`, so the table can stay detached like the other libraries' tables.
import { batch, createRoot, createSelector, createSignal, For } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { type App, clickCell, type Row } from './jsfb-shared'

export const solidApp = (): App => {
  const container = document.createElement('div')
  let setRows!: (rows: ReadonlyArray<Row>) => void
  let current: ReadonlyArray<Row> = []
  createRoot(() => {
    const [rows, setStore] = createStore<Array<Row>>([])
    const [selected, setSelected] = createSignal<number | null>(null)
    const isSelected = createSelector(selected)
    setRows = (next) => {
      // Copies: `reconcile` writes into the objects the store holds.
      current = next
      batch(() =>
        setStore(
          reconcile(
            next.map((r) => ({ ...r })),
            { key: 'id' },
          ),
        ),
      )
    }
    const remove = (id: number) => setRows(current.filter((r) => r.id !== id))
    const el = (
      <table class="table table-hover table-striped test-data">
        <tbody>
          <For each={rows}>
            {(row) => (
              <tr class={isSelected(row.id) ? 'danger' : ''}>
                <td class="col-md-1">{row.id}</td>
                <td class="col-md-4">
                  <a on:click={() => setSelected(row.id)}>{row.label}</a>
                </td>
                <td class="col-md-1">
                  <a on:click={() => remove(row.id)}>
                    <span class="glyphicon glyphicon-remove" aria-hidden="true" />
                  </a>
                </td>
                <td class="col-md-6" />
              </tr>
            )}
          </For>
        </tbody>
      </table>
    )
    container.appendChild(el as Node)
  })
  return {
    container,
    set: async (rows) => setRows(rows),
    get: () => current,
    click: async (i, cell) => clickCell(container, i, cell),
  }
}
