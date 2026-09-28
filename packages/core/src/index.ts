/**
 * packages/core/src/index.ts
 *
 * @sleekstack/core public barrel. Tags/Layers/Effect come from 'effect' directly.
 */

export { service, type Lifetime, type ServiceDefinition, type AnyServiceDefinition, type CaptiveViolations } from './service'
export { module, declareLayer, type Module, type DeclaredLayer, type Entry, type BareLayer, type Imports } from './module'
export { buildGraph, snapshot, type Graph, type GraphNode, type GraphSnapshot, type Shadowing } from './graph'
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
  type GraphError,
} from './errors'
export { canDependOn } from './lifetime'
export { makeAppScope, privateDependencyOf, resolveTag, Privacy, type AppScope, type ChildScope, type ScopeOptions } from './scope'
/** Atom definitions: `make`, `writable`, `family`, `keepAlive`, `setIdleTTL`. */
export * as Atom from './atom/Atom'
/** The async state of Effect and Stream atoms. */
export * as Result from './atom/Result'
export { makeAtomStore, type AtomStore, type AtomStoreOptions } from './atom/AtomStore'
export { atomStoreFor } from './atom/scope'
