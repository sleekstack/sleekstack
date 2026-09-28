/**
 * apps/showcase-kit/src/errors/cases.server.ts
 *
 * The error gallery, kit-only: each case builds its own throwaway Tags/modules
 * (never the real domain graph) and must throw a SleekStackError with its
 * expected `code`. Anything else is classified UNEXPECTED by `runCase`.
 */
import 'server-only'
import { layer, module, snapshot, tag, SleekStackError, type Module } from '@sleekstack/kit'

export interface CaseResult {
  readonly code: string
  readonly message: string
}

export interface ErrorCase {
  readonly id: string
  readonly expectedCode: string
  readonly run: () => unknown
}

const A = tag<string>('errors.A')
const B = tag<string>('errors.B')
const lib = (name: string) => module({ name, provide: [layer(A, () => name)] })

const cycle: { b?: Module } = {}
const CycleA = module({ name: 'errors.CycleA', imports: () => [cycle.b!] })
cycle.b = module({ name: 'errors.CycleB', imports: [CycleA] })

export const errorCases: readonly ErrorCase[] = [
  { id: 'missing-dependency', expectedCode: 'MissingDependency', run: () => snapshot(module({ name: 'errors.App', provide: [layer(B, (a) => a, [A])] })) },
  { id: 'dependency-cycle', expectedCode: 'DependencyCycle', run: () => snapshot(module({ name: 'errors.App', provide: [layer(A, (b) => b, [B]), layer(B, (a) => a, [A])] })) },
  {
    id: 'captive-dependency',
    expectedCode: 'CaptiveDependency',
    run: () => snapshot(module({ name: 'errors.App', provide: [layer(A, () => 'r', [], { lifetime: 'request' }), layer(B, (a) => a, [A])] })),
  },
  { id: 'ambiguous-provider', expectedCode: 'AmbiguousProvider', run: () => snapshot(module({ name: 'errors.App', imports: [lib('errors.L1'), lib('errors.L2')] })) },
  { id: 'module-cycle', expectedCode: 'ModuleCycle', run: () => snapshot(CycleA) },
  {
    id: 'duplicate-module',
    expectedCode: 'DuplicateModule',
    run: () => snapshot(module({ name: 'errors.App', imports: [lib('errors.X'), module({ name: 'errors.Y', imports: [lib('errors.X')] })] })),
  },
  { id: 'invalid-module', expectedCode: 'InvalidModule', run: () => module({ name: 'errors.Bad', imports: [{} as never] }) },
  { id: 'duplicate-tag', expectedCode: 'DuplicateTag', run: () => snapshot(module({ name: 'errors.App', provide: [layer(A, 'a'), layer(tag<string>('errors.A'), 'b')] })) },
  { id: 'invalid-tag', expectedCode: 'InvalidTag', run: () => tag('') },
]

/** Runs one case in isolation; a non-throw, a non-SleekStackError or a wrong code is UNEXPECTED. */
export async function runCase(errorCase: ErrorCase): Promise<CaseResult> {
  try {
    await errorCase.run()
  } catch (e) {
    if (!(e instanceof SleekStackError)) return { code: 'UNEXPECTED', message: e instanceof Error ? e.message : String(e) }
    if (e.code === errorCase.expectedCode) return { code: e.code, message: e.message }
    return { code: 'UNEXPECTED', message: `expected ${errorCase.expectedCode}, got ${e.code}: ${e.message}` }
  }
  return { code: 'UNEXPECTED', message: 'expected a SleekStackError, but nothing was thrown' }
}
