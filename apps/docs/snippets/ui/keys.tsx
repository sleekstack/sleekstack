/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { useAtomValue, useLocal } from '@sleekstack/ui'

interface Todo {
  readonly id: string
  readonly title: string
}

export const todosAtom = Atom.make<ReadonlyArray<Todo>>([])

// A row keeps its local state when the list is reordered: its key prop is its identity.
const Row = function* ({ todo }: { todo: Todo }) {
  const [done, setDone] = yield* useLocal(false)
  return (
    <li>
      <input type="checkbox" checked={done} onChange={(e) => setDone(e.currentTarget.checked)} /> {todo.title}
    </li>
  )
}

export const Todos = function* () {
  const todos = yield* useAtomValue(todosAtom)
  // Without `key`, `sleekstack check` reports MissingKey.
  return (
    <ul>
      {todos.map((t) => (
        <Row key={t.id} todo={t} />
      ))}
    </ul>
  )
}
