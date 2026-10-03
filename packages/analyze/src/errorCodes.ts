/**
 * packages/analyze/src/errorCodes.ts
 *
 * The closed set of analyzer error codes and their help: one entry per code, typed
 * `Record<AnalyzeCode, …>` so a code without an entry (or an entry without a code) fails to compile.
 * `docs` is a path into the docs app's errors page.
 */

import type { AnalyzeError, Location } from './model'

export type AnalyzeCode =
  | 'MissingDependency'
  | 'DependencyCycle'
  | 'AmbiguousProvider'
  | 'ModuleCycle'
  | 'DuplicateModule'
  | 'CaptiveDependency'
  | 'PrivateDependency'
  | 'UnownedAction'
  | 'EmittedSibling'
  | 'Unresolvable'
  | 'Computed'
  | 'UnnamedEffect'
  | 'NonLiteralOptions'
  | 'Unresolved'
  | 'UnhandledError'
  | 'EffectInsideReact'

export interface ErrorHelp {
  /** What the analyzer checks. */
  readonly rule: string
  /** Remedies, most likely first. */
  readonly fix: readonly string[]
  /** Docs path with the anchor of the code's section. */
  readonly docs: string
}

const GRAPH = '/docs/errors#graph-errors'
const READ = '/docs/errors#analyzer-read-errors'
const UI = '/docs/errors#component-errors'

export const ERROR_CODES: Readonly<Record<AnalyzeCode, ErrorHelp>> = {
  MissingDependency: {
    rule: 'Every Tag a service, action or component requires is provided by an entry in scope.',
    fix: ['Provide the Tag in this module or one it imports', 'Wrap the component in a Provide (or the mount layer) that supplies it'],
    docs: GRAPH,
  },
  DependencyCycle: {
    rule: 'Services may not require each other in a cycle.',
    fix: ['Break the cycle: move the shared part into a third service both depend on'],
    docs: GRAPH,
  },
  AmbiguousProvider: {
    rule: 'At most one provider of a Tag sits at each locality, so Shadowing can pick one.',
    fix: ['Remove one of the providers', 'Move one provider into an imported module so the closer one shadows it'],
    docs: GRAPH,
  },
  ModuleCycle: {
    rule: 'Modules may not import each other in a cycle.',
    fix: ['Extract the shared entries into a module both import'],
    docs: GRAPH,
  },
  DuplicateModule: {
    rule: 'Each module name belongs to one module.',
    fix: ['Rename one of the modules', 'Import the existing module instead of declaring a second one'],
    docs: GRAPH,
  },
  CaptiveDependency: {
    rule: 'A service may only depend on services that live at least as long (app may not capture request or component).',
    fix: ['Shorten the dependent service lifetime', 'Lengthen the dependency lifetime'],
    docs: GRAPH,
  },
  PrivateDependency: {
    rule: 'Only Tags a module exports are visible outside it.',
    fix: ['Add the Tag to the module exports', 'Depend on an exported service instead'],
    docs: GRAPH,
  },
  UnownedAction: {
    rule: 'With several runtimes, each action is imported by exactly one configureRuntime file.',
    fix: ['Pass --entry to pick the runtime', 'Import the action from the file that calls configureRuntime'],
    docs: READ,
  },
  EmittedSibling: {
    rule: 'Emitted .js/.d.ts output does not sit next to its .ts source.',
    fix: ['Delete the emitted file', 'Set outDir (or noEmit) in tsconfig'],
    docs: READ,
  },
  Unresolvable: {
    rule: 'Every declaration in the graph is statically readable; the analyzer fails closed.',
    fix: ['Use a literal or a direct reference instead of a computed value', 'Annotate the value with its Layer type'],
    docs: READ,
  },
  Computed: {
    rule: 'Provide lists, imports and names are statically evaluable (literals, local consts, loops over literal lists).',
    fix: ['Replace the computed expression with a literal list or a local const'],
    docs: READ,
  },
  UnnamedEffect: {
    rule: 'effect() in a module has a literal name, so its graph identity is static.',
    fix: ['Pass a string literal `name` to effect()'],
    docs: READ,
  },
  NonLiteralOptions: {
    rule: 'runEffect options are statically readable.',
    fix: ['Pass the options as an object literal at the call'],
    docs: READ,
  },
  Unresolved: {
    rule: 'Every component and Layer in a mount tree is statically readable (no any, no dynamically picked component).',
    fix: ['Type the component or Layer explicitly', 'Render the component directly instead of picking it at run time'],
    docs: UI,
  },
  UnhandledError: {
    rule: 'Every tagged error a component can fail with is caught before mount.',
    fix: ['Wrap the component in a Catch for the error tag', 'Handle the error inside the component'],
    docs: UI,
  },
  EffectInsideReact: {
    rule: 'Effect components are not rendered under a fromReact guest.',
    fix: ['Move the Effect component out of the React guest', 'Convert the guest subtree to Effect components'],
    docs: UI,
  },
}

/** An error with its code's fix and docs filled in. */
export const analyzeError = (code: AnalyzeCode, message: string, at: Location & Partial<Pick<AnalyzeError, 'column' | 'endLine' | 'endColumn'>>): AnalyzeError => ({
  ...at,
  code,
  message,
  fix: ERROR_CODES[code].fix,
  docs: ERROR_CODES[code].docs,
})
