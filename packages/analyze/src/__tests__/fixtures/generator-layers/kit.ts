import { layer, module, tag } from '@sleekstack/kit'
import { opaqueGen } from './ext'
import { R, readsR } from './gens'
const A = tag<string>('A')
const B = tag<string>('B')
const C = tag<string>('C')
const D = tag<string>('D')
const Z = tag<string>('Z')
function* helper() {
  return yield* A
}
export const Ok = module({
  name: 'Ok',
  provide: [layer(B, function* () { return (yield* helper()) + (yield* A) }), layer(A, () => 'a')],
})
export const Missing = module({
  name: 'Missing',
  provide: [layer(B, function* () { return yield* Z })], // @error MissingDependency
})
export const Captive = module({
  name: 'Captive',
  provide: [
    layer(A, () => 'r', [], { lifetime: 'request' }),
    layer(B, function* () { return yield* A }), // @error CaptiveDependency
  ],
})
export const Cycle = module({
  name: 'Cycle',
  provide: [
    layer(C, function* () { return yield* D }),
    layer(D, function* () { return yield* C }, { lifetime: 'app' }), // @error DependencyCycle
  ],
})
declare const flag: boolean
function* yieldsA() { return yield* A }
function* yieldsZ() { return yield* Z }
const makeGen = () => function* () { return 'x' }
export const Conditional = module({
  name: 'Conditional',
  provide: [layer(A, () => 'a'), layer(B, flag ? yieldsA : yieldsZ)], // @error MissingDependency
})
export const Factory = module({
  name: 'Factory',
  provide: [layer(B, makeGen())], // @error Unresolvable
})
export const Declared = module({
  name: 'Declared',
  provide: [layer(B, opaqueGen)], // @error Unresolvable
})
export const ImportedLifetime = module({
  name: 'ImportedLifetime',
  provide: [
    layer(R, () => 'r', [], { lifetime: 'request' }),
    layer(C, readsR, { lifetime: 'request' }),
    layer(D, readsR), // @error CaptiveDependency
  ],
})
