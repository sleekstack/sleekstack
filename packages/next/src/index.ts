/**
 * packages/next/src/index.ts
 *
 * @sleekstack/next public barrel (R8): the Next.js adapter over the core scope runtime.
 */

export { configureRuntime, RuntimeNotConfigured, type RuntimeConfig } from './runtime'
export { action, query, type Operation, type OperationOptions } from './action'
