/**
 * packages/core/src/errors.ts
 *
 * Tagged graph errors: the scope runtime and child boundaries throw these (GraphError); module() throws InvalidModule.
 */

import { Data } from 'effect'

/** Error code `MissingDependency`: a service requires a Tag that no entry provides. */
export class MissingDependency extends Data.TaggedError('MissingDependency')<{
  /** The missing Tag key, on a scope lookup miss (see {@link missingDependency}). */
  readonly tag?: string
  readonly service: string
  readonly missing: string
  readonly module?: string
  readonly message: string
}> {}

/** @internal The canonical scope-lookup miss: `requiredBy` looked up `key`, and nothing provides it. */
export const missingDependency = (key: string, requiredBy: string): MissingDependency =>
  new MissingDependency({
    tag: key,
    service: requiredBy,
    missing: key,
    message: `"${requiredBy}" requires "${key}", which is not provided`,
  })

/** Error code `DependencyCycle`: services require each other in a cycle (`path` lists it). */
export class DependencyCycle extends Data.TaggedError('DependencyCycle')<{
  readonly path: readonly string[]
  readonly message: string
}> {}

/** Error code `AmbiguousProvider`: several entries at the same locality provide one Tag. */
export class AmbiguousProvider extends Data.TaggedError('AmbiguousProvider')<{
  readonly tag: string
  readonly modules: readonly string[]
  readonly message: string
}> {}

/** Error code `ModuleCycle`: modules import each other in a cycle (`path` lists it). */
export class ModuleCycle extends Data.TaggedError('ModuleCycle')<{
  readonly path: readonly string[]
  readonly message: string
}> {}

/** Error code `DuplicateModule`: two distinct modules share one name. */
export class DuplicateModule extends Data.TaggedError('DuplicateModule')<{
  readonly name: string
  readonly message: string
}> {}

/** Error code `InvalidModule`: a module, entry, or declared Layer is malformed. */
export class InvalidModule extends Data.TaggedError('InvalidModule')<{
  readonly name?: string
  readonly message: string
}> {}

/** Every graph error code (reported statically by `sleekstack check`; the runtime keeps resolve-time backstops). */
export type GraphError =
  | MissingDependency
  | DependencyCycle
  | AmbiguousProvider
  | ModuleCycle
  | DuplicateModule
  | InvalidModule
  | CaptiveDependency
  | PrivateDependency

/** A private Tag (not in its module's `exports`) was required from outside that module. */
export class PrivateDependency extends Data.TaggedError('PrivateDependency')<{
  readonly tag: string
  readonly module: string
  readonly requiredBy: string
  readonly message: string
}> {}

/** Error code `CaptiveDependency`: a service depends on one whose lifetime it may not capture. */
export class CaptiveDependency extends Data.TaggedError('CaptiveDependency')<{
  readonly service: string
  readonly lifetime: string
  readonly dependency: string
  readonly dependencyLifetime: string
  readonly message: string
}> {}

/** Error code `AtomCycle`: atoms read each other in a cycle (`path` lists their labels). */
export class AtomCycle extends Data.TaggedError('AtomCycle')<{
  readonly path: readonly string[]
  readonly message: string
}> {}

/** Error code `DuplicateAtomKey`: two distinct serializable atoms built in one store share a key. */
export class DuplicateAtomKey extends Data.TaggedError('DuplicateAtomKey')<{
  readonly key: string
  readonly message: string
}> {}
