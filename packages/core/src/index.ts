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
  type GraphError,
} from './errors'
