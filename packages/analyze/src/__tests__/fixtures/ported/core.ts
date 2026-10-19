// Ported core buildGraph and snapshot tests (see .flow/notes/fn-9-build-time-error-port-list.md). One root module per case.
import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, number>() {}
class R extends Context.Tag('R')<R, number>() {}
class C extends Context.Tag('C')<C, number>() {}
class Raw extends Context.Tag('Raw')<Raw, string>() {}
class Repo extends Context.Tag('Repo')<Repo, string>() {}
const one = Effect.succeed(1)

// lifetime.test: request -> component and component -> request are captive.
export const ReqToComp = module({ name: 'ReqToComp', entries: [
  declareLayer(Layer.effect(R, Effect.as(C, one as never)), { lifetime: 'request' }), // @error CaptiveDependency
  declareLayer(Layer.succeed(C, one as never), { lifetime: 'component' }),
] })
export const CompToReq = module({ name: 'CompToReq', entries: [
  declareLayer(Layer.effect(C, Effect.as(R, one as never)), { lifetime: 'component' }), // @error CaptiveDependency
  declareLayer(Layer.succeed(R, one as never), { lifetime: 'request' }),
] })
// lifetime.test: request/component -> app is allowed.
export const ShortToApp = module({ name: 'ShortToApp', entries: [
  declareLayer(Layer.succeed(A, one as never)),
  declareLayer(Layer.effect(R, Effect.as(A, one as never)), { lifetime: 'request' }),
  declareLayer(Layer.effect(C, Effect.as(A, one as never)), { lifetime: 'component' }),
] })
// lifetime.test: a declared Layer takes its module's lifetime.
const ReqMod = module({ name: 'ReqMod', lifetime: 'request', entries: [declareLayer(Layer.succeed(R, 1))] })
export const DeclaredCaptive = module({ name: 'DeclaredCaptive', imports: [ReqMod], entries: [
  declareLayer(Layer.effect(A, Effect.as(R, one as never))), // @error CaptiveDependency
] })

// cycle.test: A(new) -> B -> A(old) is DuplicateModule, not a cycle.
const OldA = module({ name: 'A' }) // @error DuplicateModule
const B = module({ name: 'B', imports: [OldA] })
export const NewA = module({ name: 'A', imports: [B] })

// graph.test: a Tag only a bare Layer provides -> MissingDependency with the declareLayer hint.
export const Data = module({ name: 'Data', entries: [
  Layer.succeed(Raw, 'raw'),
  declareLayer(Layer.effect(Repo, Effect.as(Raw, 'r' as never))), // @error MissingDependency
] })

// privacy.test: omitted exports = all public; an outside provider may shadow a private Tag.
class Db extends Context.Tag('Db')<Db, string>() {}
class Out extends Context.Tag('Out')<Out, string>() {}
const Open = module({ name: 'Open', entries: [declareLayer(Layer.succeed(Db, 'db'))] })
export const OpenApp = module({ name: 'OpenApp', imports: [Open], entries: [declareLayer(Layer.effect(Out, Db))] })
const Private = module({ name: 'Private', entries: [declareLayer(Layer.succeed(Db, 'db'))], exports: [] })
export const ShadowApp = module({ name: 'ShadowApp', imports: [Private], entries: [
  declareLayer(Layer.succeed(Db, 'mine')),
  declareLayer(Layer.effect(Out, Db)),
] })
