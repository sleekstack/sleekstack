'use server'
// A 'use server' file may export only async functions, so each operation is wrapped in one.
import { layer, module, tag } from '@sleekstack/kit'
import { action, configureRuntime, fail, query } from '@sleekstack/kit/next'

interface Todos {
  list(): Promise<string[]>
  add(title: string): Promise<string>
}
const Todos = tag<Todos>('Todos')

const items: string[] = []
const TodosLive = layer(Todos, {
  list: async () => [...items],
  add: async (title) => (items.push(title), title),
})

// Once, at module load (for example from instrumentation.ts).
configureRuntime({
  provide: [module({ name: 'app', provide: [TodosLive] })],
  onFinalizerError: (e) => console.error(`cleanup of ${e.tag ?? '?'} failed: ${e.message}`),
})

// Resolves { ok: true, data } or, after fail(), { ok: false, error }.
const add = action((todos) => async (title: string) => (title.trim() ? todos.add(title) : fail('Title is required')), [Todos])
export async function addTodo(title: string) {
  return add(title)
}

// Resolves the plain value; fail() rejects.
const list = query((todos) => () => todos.list(), [Todos])
export async function listTodos() {
  return list()
}
