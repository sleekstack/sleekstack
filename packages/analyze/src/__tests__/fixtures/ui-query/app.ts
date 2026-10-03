import { Effect, Layer } from 'effect'
import { el, mount } from '@sleekstack/ui'
import { useQuery } from '@sleekstack/ui/query'
import { QueryClientLive } from '@sleekstack/query'

const List = () =>
  Effect.gen(function* () {
    const q = yield* useQuery({ queryKey: ['todos'], queryFn: async () => ['a'] })
    return el('ul', {}, String(q.data))
  })

export const ok = (c: Element) => mount(List(), { layer: QueryClientLive(), container: c })
export const bad = (c: Element) => mount(List(), { layer: Layer.empty, container: c }) // @error MissingDependency
