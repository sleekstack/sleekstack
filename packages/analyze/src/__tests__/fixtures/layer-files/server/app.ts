import { start } from '@sleekstack/start'
import { Layer } from 'effect'
import { Config } from '../services'

/** The explicit layer shadows `src/z-config.layer.ts`'s `Config`: no conflict. */
export const app = start({ layer: Layer.succeed(Config, { url: 'memory:' }) })
