/**
 * packages/runtime/src/index.ts
 *
 * @sleekstack/runtime public barrel: the framework-agnostic Effect app runtime.
 */

export {
  configureRuntime,
  getRuntime,
  reportFinalizerFailure,
  runEffect,
  RuntimeNotConfigured,
  devEnabled,
  devEvents,
  devLive,
  DEV_EVENT_LIMIT,
  type ControlFlowClassifier,
  type DevEvent,
  type ErrorInfo,
  type ErrorSink,
  type RunEffectOptions,
  type RuntimeConfig,
} from './runtime'
