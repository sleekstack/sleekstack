import { layer, module, tag } from '@sleekstack/kit'
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
