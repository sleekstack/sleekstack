import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
const A = Context.GenericTag<string>('A')
const B = Context.GenericTag<string>('B')
const L1 = module({ name: 'L1', entries: [service(A, {}, () => Effect.succeed('l1'))] })
const L2 = module({ name: 'L2', entries: [service(A, {}, () => Effect.succeed('l2'))] }) // @error AmbiguousProvider
export const App = module({ name: 'App', imports: [L1, L2] })
