// Ported core buildGraph tests (see .flow/notes/fn-9-build-time-error-port-list.md). One root module per case.
import { Context, Effect, Layer } from 'effect'
import { declareLayer, module, service } from '@sleekstack/core'
const A = Context.GenericTag<number>('A')
const R = Context.GenericTag<number>('R')
const C = Context.GenericTag<number>('C')
const Raw = Context.GenericTag<string>('Raw')
const Repo = Context.GenericTag<string>('Repo')
const one = Effect.succeed(1)

// lifetime.test: request -> component and component -> request are captive.
export const ReqToComp = module({ name: 'ReqToComp', entries: [
  service(R, { requires: [C], lifetime: 'request' }, () => one), // @error CaptiveDependency
  service(C, { lifetime: 'component' }, () => one),
] })
export const CompToReq = module({ name: 'CompToReq', entries: [
  service(C, { requires: [R], lifetime: 'component' }, () => one), // @error CaptiveDependency
  service(R, { lifetime: 'request' }, () => one),
] })
// lifetime.test: request/component -> app is allowed.
export const ShortToApp = module({ name: 'ShortToApp', entries: [
  service(A, {}, () => one),
  service(R, { requires: [A], lifetime: 'request' }, () => one),
  service(C, { requires: [A], lifetime: 'component' }, () => one),
] })
// lifetime.test: a declared Layer takes its module's lifetime.
const ReqMod = module({ name: 'ReqMod', lifetime: 'request', entries: [declareLayer(Layer.succeed(R, 1), { provides: [R] })] })
export const DeclaredCaptive = module({ name: 'DeclaredCaptive', imports: [ReqMod], entries: [
  service(A, { requires: [R] }, () => one), // @error CaptiveDependency
] })

// cycle.test: A(new) -> B -> A(old) is DuplicateModule, not a cycle.
const OldA = module({ name: 'A' }) // @error DuplicateModule
const B = module({ name: 'B', imports: [OldA] })
export const NewA = module({ name: 'A', imports: [B] })

// graph.test: a Tag only a bare Layer provides -> MissingDependency with the declareLayer hint.
export const Data = module({ name: 'Data', entries: [
  Layer.succeed(Raw, 'raw'),
  service(Repo, { requires: [Raw] }, () => Effect.succeed('r')), // @error MissingDependency
] })
