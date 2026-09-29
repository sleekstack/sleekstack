import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
const A = Context.GenericTag<string>('A')
const B = Context.GenericTag<string>('B')
export const App = module({
  name: 'App',
  entries: [
    service(A, { requires: [B] }, () => Effect.succeed('a')),
    service(B, { requires: [A] }, () => Effect.succeed('b')), // @error DependencyCycle
  ],
})
