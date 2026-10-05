/**
 * apps/showcase-kit/src/errors/cases.server.ts
 *
 * The error gallery, kit-only. Graph errors are build-time: the broken graphs live in `graphs.ts`
 * and their errors come from the analyzer's prebuilt report. The runtime-only cases below build
 * throwaway Tags/modules and must throw a SleekStackError with their expected `code`; anything else
 * is classified UNEXPECTED by `runCase`.
 */
import 'server-only'
import { layer, module, tag, SleekStackError } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'

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

/** Runtime-only cases: thrown while defining or combining modules, never seen by the analyzer. */
export const errorCases: readonly ErrorCase[] = [
  {
    id: 'invalid-module',
    expectedCode: 'InvalidModule',
    run: () => module({ name: 'errors.Bad', imports: [{} as never] }),
  },
  // configureRuntime validates the provide set before configuring, so this never replaces the app's runtime.
  // Not an analyzer root: `sleekstack check` runs with `--entry src/server/runtime.server.ts`.
  {
    id: 'duplicate-tag',
    expectedCode: 'DuplicateTag',
    run: () =>
      configureRuntime({
        provide: [module({ name: 'errors.App', provide: [layer(A, 'a'), layer(tag<string>('errors.A'), 'b')] })],
      }),
  },
  { id: 'invalid-tag', expectedCode: 'InvalidTag', run: () => tag('') },
]

/** Build-time cases: each broken root module in `graphs.ts`, rendered from the analyzer's report. */
export const buildTimeCases = [
  { id: 'missing-dependency', expectedCode: 'MissingDependency' },
  { id: 'dependency-cycle', expectedCode: 'DependencyCycle' },
  { id: 'captive-dependency', expectedCode: 'CaptiveDependency' },
  { id: 'ambiguous-provider', expectedCode: 'AmbiguousProvider' },
  { id: 'module-cycle', expectedCode: 'ModuleCycle' },
  { id: 'duplicate-module', expectedCode: 'DuplicateModule' },
  { id: 'private-dependency', expectedCode: 'PrivateDependency' },
] as const

export const GRAPHS_FILE = 'src/errors/graphs.ts'

/** The report's error for each build-time case (UNEXPECTED when the analyzer did not report its code in graphs.ts). */
export function buildTimeResults(
  graphErrors: readonly { code: string; message: string; file: string; line: number }[],
): (CaseResult & { id: string; at: string })[] {
  return buildTimeCases.map(({ id, expectedCode }) => {
    const e = graphErrors.find((x) => x.file === GRAPHS_FILE && x.code === expectedCode)
    return e
      ? { id, code: e.code, message: e.message, at: `${e.file}:${e.line}` }
      : { id, code: 'UNEXPECTED', message: `the analyzer reported no ${expectedCode} in ${GRAPHS_FILE}`, at: '' }
  })
}

/** Runs one case in isolation; a non-throw, a non-SleekStackError or a wrong code is UNEXPECTED. */
export async function runCase(errorCase: ErrorCase): Promise<CaseResult> {
  try {
    await errorCase.run()
  } catch (e) {
    if (!(e instanceof SleekStackError))
      return { code: 'UNEXPECTED', message: e instanceof Error ? e.message : String(e) }
    if (e.code === errorCase.expectedCode) return { code: e.code, message: e.message }
    return { code: 'UNEXPECTED', message: `expected ${errorCase.expectedCode}, got ${e.code}: ${e.message}` }
  }
  return { code: 'UNEXPECTED', message: 'expected a SleekStackError, but nothing was thrown' }
}
