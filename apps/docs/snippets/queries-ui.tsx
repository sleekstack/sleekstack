import { createElement } from 'react'
import { Effect } from 'effect'
import { el, fromReact, mount } from '@sleekstack/ui'
import { UiQueryClientLive, useMutation, useQuery } from '@sleekstack/query/ui'
import { QueryClientTag } from '@sleekstack/query'

let todos = ['Write docs']

const List = () =>
  Effect.gen(function* () {
    // One shared QueryObserver per key; the component re-runs when its result changes.
    const { data, isPending } = yield* useQuery({ queryKey: ['todos'], queryFn: async () => todos })
    if (isPending) return el('p', {}, 'Loading')
    return el('ul', {}, ...(data ?? []).map((t) => el('li', {}, t)))
  })

// A React guest handles the click; `mutate` is a plain function, so it travels as a prop.
const AddButton = fromReact(({ onAdd }: { onAdd: () => void }) => createElement('button', { onClick: onAdd }, 'Add'))

const Add = () =>
  Effect.gen(function* () {
    const client = yield* QueryClientTag
    // One MutationObserver per component instance; the list refetches after a successful add.
    const add = yield* useMutation({
      mutationFn: async (title: string) => void (todos = [...todos, title]),
      onSuccess: () => client.invalidateQueries({ queryKey: ['todos'] }),
    })
    return yield* AddButton({ onAdd: () => add.mutate('Ship docs') })
  })

export const start = (container: Element) =>
  mount(
    Effect.map(Effect.all([List(), Add()]), (nodes) => el('div', {}, ...nodes)),
    { layer: UiQueryClientLive(), container },
  )
