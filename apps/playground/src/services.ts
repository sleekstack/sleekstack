import * as Effect from 'effect'
import { createService, layer } from '@sleekstack/core'

export const SleepService = createService<number>('SleepService')

// Build a simple effect that produces a timestamp after a short delay to simulate async acquisition
const makeEffect = (Effect as any).succeedWith
  ? (Effect as any).succeedWith(() => Date.now())
  : (Effect as any).succeed(Date.now())

export const SleepLayer = layer(SleepService, makeEffect)

