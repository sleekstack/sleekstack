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
