import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
const A = Context.GenericTag<string>('A')
const B = Context.GenericTag<string>('B')
const C = Context.GenericTag<string>('C')
const Lib = module({ name: 'Lib', entries: [service(A, {}, () => Effect.succeed('s')), service(B, { requires: [A] }, () => Effect.succeed('b'))], exports: [B] })
export const App = module({ name: 'App', imports: [Lib], entries: [service(C, { requires: [A] }, () => Effect.succeed('c'))] }) // @error PrivateDependency
