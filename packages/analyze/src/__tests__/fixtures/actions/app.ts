import { layer, module, tag } from '@sleekstack/kit'
import { configureRuntime, defineEffect, defineQuery, effect, query } from '@sleekstack/kit/next'

export const A = tag<string>('A')
export const B = tag<string>('B')
const Hidden = tag<string>('Hidden')
const Nowhere = tag<string>('Nowhere')
const Loose: any = tag<string>('Loose')
const Tags = { A, B } as Record<string, typeof A>

const Lib = module({ name: 'Lib', provide: [layer(A, 'a'), layer(Hidden, 'h')], exports: [A] })
configureRuntime({ provide: [Lib, layer(B, 'b')] })

function* helper() {
  return (yield* B) + (yield* Nowhere) // @error MissingDependency
}

export const ok = defineEffect(function* () {
  return (yield* A) + (yield* B)
}, [A, B])

const onlyA = [A] as const
export const drift = defineQuery(function* () {
  return yield* B // @error UndeclaredDependency
}, onlyA)

export const viaHelper = defineEffect(function* () {
  return yield* helper()
}, [B, Nowhere])

export async function inline(k: string) {
  await effect(function* () { return yield* Hidden }, [Hidden]) // @error PrivateDependency
  await query(function* () { return yield* Loose }, []) // @error Unresolvable
  return query(function* () { return yield* Tags[k]! }, []) // @error Unresolvable
}

const OnlyHere = tag<string>('OnlyHere')
function* read(t: typeof A) {
  return yield* t
}
const either = Math.random() > 0.5 ? A : B
export const bound = defineEffect(function* () {
  return (yield* read(A)) + (yield* read(B)) + (yield* either)
}, [A, B])
export const provided = defineQuery(function* () {
  return yield* OnlyHere
}, [OnlyHere], { provide: async () => [layer(OnlyHere, 'o')] })
export const providedList = defineQuery(function* () {
  return yield* OnlyHere
}, [OnlyHere], { provide: [layer(OnlyHere, (b) => b, [Nowhere])] }) // @error MissingDependency
const WithGap = module({ name: 'WithGap', provide: [layer(OnlyHere, (b) => b, [Nowhere])] }) // @error MissingDependency
export const providedModule = defineQuery(function* () {
  return yield* OnlyHere
}, [OnlyHere], { provide: [WithGap] })
