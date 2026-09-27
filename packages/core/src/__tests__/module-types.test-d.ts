import { Context, Layer } from 'effect'
import { module } from '../module'

class A extends Context.Tag('A')<A, number>() {}
class B extends Context.Tag('B')<B, number>() {}

const selfContained = Layer.succeed(A, 1)
const needsA = Layer.effect(B, A)

module({ name: 'ok', entries: [selfContained] })
// @ts-expect-error bare raw Layers must have requirement type never
module({ name: 'bad', entries: [needsA] })
