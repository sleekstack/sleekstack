/**
 * packages/core/src/index.ts
 *
 * @sleekstack/core public barrel. Tags/Layers/Effect come from 'effect' directly.
 */

export type { Lifetime } from './lifetime'
export {
  module,
  declareLayer,
  type Module,
  type DeclaredLayer,
  type Entry,
  type BareLayer,
  type Imports,
} from './module'
export {
  MissingDependency,
  DependencyCycle,
  AmbiguousProvider,
  ModuleCycle,
  DuplicateModule,
  InvalidModule,
  CaptiveDependency,
  PrivateDependency,
  AtomCycle,
  DuplicateAtomKey,
  type GraphError,
} from './errors'
/** @internal Lazy per-scope resolution for generator layers. */
export { Resolver, type Resolve } from './lazy'
export {
  makeAppScope,
  resolutionFailure,
  resolveTag,
  resolveTagEffect,
  type AppScope,
  type ChildScope,
  type ScopeOptions,
} from './scope'
/** Atom definitions: `make`, `writable`, `family`, `keepAlive`, `setIdleTTL`. */
export * as Atom from './atom/Atom'
/** The async state of Effect and Stream atoms. */
export * as Result from './atom/Result'
export {
  makeAtomStore,
  markedWrites,
  notifyMarked,
  dehydrate,
  hydrate,
  type AtomStore,
  type AtomStoreOptions,
  type Snapshot,
} from './atom/AtomStore'
export { atomStoreFor } from './atom/scope'
