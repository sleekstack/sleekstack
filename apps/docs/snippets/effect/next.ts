import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
import { action, configureRuntime, query } from '@sleekstack/next'

class Todos extends Context.Tag('Todos')<Todos, { list(): string[]; add(title: string): string }>() {}

const items: string[] = []
const TodosLive = service(Todos, {}, () =>
  Effect.succeed({ list: () => [...items], add: (title: string) => (items.push(title), title) }))

configureRuntime({ provide: [module({ name: 'app', entries: [TodosLive] })] })

export const addTodo = action((title: string) =>
  Effect.gen(function* () {
    const todos = yield* Todos
    return todos.add(title)
  }))

export const listTodos = query(() => Effect.map(Todos, (todos) => todos.list()))
