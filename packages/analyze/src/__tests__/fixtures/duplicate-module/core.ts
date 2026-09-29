import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
const A = Context.GenericTag<string>('A')
const B = Context.GenericTag<string>('B')
const X1 = module({ name: 'X', entries: [service(A, {}, () => Effect.succeed('x1'))] })
const X2 = module({ name: 'X', entries: [service(B, {}, () => Effect.succeed('x2'))] }) // @error DuplicateModule
export const App = module({ name: 'App', imports: [X1, module({ name: 'Y', imports: [X2] })] })
