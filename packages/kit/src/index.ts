/**
 * packages/kit/src/index.ts
 *
 * @sleekstack/kit public barrel. No Effect or core type is reachable from here.
 */

export { tag, type Tag, type TagLike, type ServiceOf } from './tag'
export { layer, withCleanup, type Layer, type Cleanup, type LayerOptions, type Lifetime, type Services, type Impl } from './layer'
export { module, snapshot, type Module, type ModuleConfig, type Imports, type GraphSnapshot } from './module'
export { effect, type EffectOptions } from './effect'
export { SleekStackError, type SleekStackErrorCode, type FinalizerError } from './errors'
