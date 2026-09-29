'use server'
// A 'use server' file may export only literal async functions; defineEffect()/defineQuery() are
// directly callable, so export a literal async function that calls them (or use effect()/query() inline).
import { Effect } from 'effect'
import { layer, module, tag } from '@sleekstack/kit'
import { configureRuntime, defineEffect, defineQuery, fail } from '@sleekstack/kit/next'

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

const addTodoEffect = defineEffect(function* (title: string) {
  const todos = yield* Todos
  return title.trim() ? yield* Effect.promise(() => todos.add(title)) : fail('Title is required')
})

const listTodosQuery = defineQuery(function* () {
  const todos = yield* Todos
  return yield* Effect.promise(() => todos.list())
})

// Resolves { ok: true, data } or, after fail(), { ok: false, error }.
export async function addTodo(title: string) {
  return addTodoEffect(title)
}

// Resolves the plain value; fail() rejects.
export async function listTodos() {
  return listTodosQuery()
}
