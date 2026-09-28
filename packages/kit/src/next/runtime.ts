/**
 * packages/kit/src/next/runtime.ts
 *
 * Kit-typed `configureRuntime`: validates and unwraps the provide set, adapts the
 * finalizer sink to a plain FinalizerError, and caches the lowered config per kit
 * config reference so next's same-reference no-op still holds.
 */

import { configureRuntime as nextConfigure, type RuntimeConfig as NextConfig } from '@sleekstack/next'
import { Cause } from 'effect'
import { normalize, type FinalizerError } from '../errors'
import type { Layer } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'

export interface RuntimeConfig {
  readonly provide: ReadonlyArray<Layer<any> | Module>
  readonly onFinalizerError?: (e: FinalizerError) => void
}

/** @internal Cause -> plain FinalizerError. */
export const toFinalizerError = (cause: Cause.Cause<unknown>): FinalizerError => {
  const e = normalize(cause)
  const tag = e.details.tag
  return typeof tag === 'string' ? { message: e.message, tag } : { message: e.message }
}

const lowered = new WeakMap<RuntimeConfig, NextConfig>()

export function configureRuntime(config: RuntimeConfig): void {
  let next = lowered.get(config)
  if (!next) {
    try {
      validateProvide(config.provide)
      const sink = config.onFinalizerError
      next = {
        provide: unwrap(config.provide),
        ...(sink && { onFinalizerError: (cause: Cause.Cause<unknown>) => sink(toFinalizerError(cause)) }),
      }
    } catch (e) {
      throw normalize(e)
    }
    lowered.set(config, next)
  }
  nextConfigure(next)
}
