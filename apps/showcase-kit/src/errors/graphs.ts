/**
 * apps/showcase-kit/src/errors/graphs.ts
 *
 * The build-time half of the error gallery: deliberately broken graphs, each a root module no
 * runtime reaches. Never imported or executed; `sleekstack check` reports each one's error with
 * file:line in the prebuilt report (`graphErrors`), which the errors page renders.
 */
import { layer, module, tag } from '@sleekstack/kit'

const A = tag<string>('errors.A')
const B = tag<string>('errors.B')
const C = tag<string>('errors.C')

export const MissingDependency = module({ name: 'errors.missing-dependency', provide: [layer(B, (a) => a, [A])] })

export const DependencyCycle = module({ name: 'errors.dependency-cycle', provide: [layer(A, (b) => b, [B]), layer(B, (a) => a, [A])] })

export const CaptiveDependency = module({
  name: 'errors.captive-dependency',
  provide: [layer(A, () => 'r', [], { lifetime: 'request' }), layer(B, (a) => a, [A])],
})

const L1 = module({ name: 'errors.L1', provide: [layer(A, () => 'l1')] })
const L2 = module({ name: 'errors.L2', provide: [layer(A, () => 'l2')] })
export const AmbiguousProvider = module({ name: 'errors.ambiguous-provider', imports: [L1, L2] })

const CycleA = module({ name: 'errors.CycleA', imports: () => [CycleB] })
const CycleB = module({ name: 'errors.CycleB', imports: [CycleA] })
export const ModuleCycle = module({ name: 'errors.module-cycle', imports: [CycleA] })

const X1 = module({ name: 'errors.X', provide: [layer(A, () => 'x1')] })
const X2 = module({ name: 'errors.X', provide: [layer(B, () => 'x2')] })
export const DuplicateModule = module({ name: 'errors.duplicate-module', imports: [X1, module({ name: 'errors.Y', imports: [X2] })] })

const Lib = module({ name: 'errors.Lib', provide: [layer(A, 'secret'), layer(B, (a) => a, [A])], exports: [B] })
export const PrivateDependency = module({ name: 'errors.private-dependency', imports: [Lib], provide: [layer(C, (a) => a, [A])] })
