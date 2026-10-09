import { Effect } from 'effect'
import { el, lazy } from '../index'

lazy(async () => ({ default: (p: { n: string }) => Effect.succeed(el('b', {}, p.n)) }))
// @ts-expect-error a default export that is not a component is rejected
lazy(async () => ({ default: () => 123 }))
