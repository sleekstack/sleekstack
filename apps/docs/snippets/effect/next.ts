'use server'
import { Context, Effect, Layer } from 'effect'
import { configureRuntime, runEffect } from '@sleekstack/next'

class Todos extends Context.Tag('Todos')<Todos, { list(): string[]; add(title: string): string }>() {}

const items: string[] = []
const TodosLive = Layer.succeed(Todos, {
  list: () => [...items],
  add: (title: string) => (items.push(title), title),
})

configureRuntime({ layer: TodosLive })

export async function addTodo(title: string) {
  return runEffect(Effect.flatMap(Todos, (todos) => Effect.sync(() => todos.add(title))))
}

export async function listTodos() {
  return runEffect(Effect.map(Todos, (todos) => todos.list()))
}
