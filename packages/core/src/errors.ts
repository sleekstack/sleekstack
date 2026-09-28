/**
 * packages/core/src/errors.ts
 *
 * Tagged graph errors. buildGraph throws these (GraphError); module() throws InvalidModule.
 */

import { Data } from 'effect'

export class MissingDependency extends Data.TaggedError('MissingDependency')<{
  readonly service: string
  readonly missing: string
  readonly module?: string
  readonly message: string
}> {}

export class DependencyCycle extends Data.TaggedError('DependencyCycle')<{
  readonly path: readonly string[]
  readonly message: string
}> {}

export class AmbiguousProvider extends Data.TaggedError('AmbiguousProvider')<{
  readonly tag: string
  readonly modules: readonly string[]
  readonly message: string
}> {}

export class ModuleCycle extends Data.TaggedError('ModuleCycle')<{
  readonly path: readonly string[]
  readonly message: string
}> {}

export class DuplicateModule extends Data.TaggedError('DuplicateModule')<{
  readonly name: string
  readonly message: string
}> {}

export class InvalidModule extends Data.TaggedError('InvalidModule')<{
  readonly name?: string
  readonly message: string
}> {}

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

export class CaptiveDependency extends Data.TaggedError('CaptiveDependency')<{
  readonly service: string
  readonly lifetime: string
  readonly dependency: string
  readonly dependencyLifetime: string
  readonly message: string
}> {}
