/**
 * packages/analyze/src/layerFiles.ts
 *
 * The Layer File pass (ADR 0054): every `*.layer.ts` file of the program, imported or a root, but tests, its default export a Layer read
 * from its type (`ROut` what it provides, `RIn` what it requires), composed by requirement; and the Server Root, the
 * server directory's `_app.ts`, whose one export is `onError`.
 */

import * as path from 'node:path'
import ts from 'typescript'
import { analyzeError } from './errorCodes'
import { programOf } from './extract'
import type { AnalyzeCode, AnalyzeError, Location } from './model'
import { layerTypes, locationOf, membersOf, programSourcesOf } from './serverServices'

const LAYER_FILE = /\.layer\.ts$/
const SERVER_ROOT = '_app.ts'

/** A Layer File whose default export (`at`) is a Layer, with its Tags. */
export interface LayerFileTags {
  readonly sf: ts.SourceFile
  readonly at: ts.Node
  readonly provides: readonly ts.Type[]
  readonly requires: readonly ts.Type[]
}
/** A Layer File, or why its default export is not a Layer. */
export type LayerFileRead = LayerFileTags | { readonly sf: ts.SourceFile; readonly at: ts.Node; readonly shape: string }

/** Each `*.layer.ts` file of `sources` with its default export read as a Layer. */
export const readLayerFiles = (sources: readonly ts.SourceFile[], checker: ts.TypeChecker): LayerFileRead[] =>
  sources
    .filter((sf) => LAYER_FILE.test(sf.fileName))
    .map((sf): LayerFileRead => {
      const module = checker.getSymbolAtLocation(sf)
      const exported = module && checker.getExportsOfModule(module).find((e) => e.name === 'default')
      const value = exported && (exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported)
      // A type-only default is erased: there is no Layer to compose.
      if (!exported || !value || !(value.flags & ts.SymbolFlags.Value))
        return { sf, at: sf, shape: 'has no default export; export default a Layer' }
      const at = exported.declarations?.[0] ?? sf
      const type = checker.getTypeOfSymbol(value)
      const layer = layerTypes(type, checker)
      if (type.flags & ts.TypeFlags.Any || (layer && (layer.out.flags | layer.in.flags) & ts.TypeFlags.Any))
        return { sf, at, shape: 'has a default export typed `any`; write out its Layer type' }
      if (!layer) return { sf, at, shape: 'has a default export that is not a Layer' }
      return { sf, at, provides: membersOf(layer.out), requires: membersOf(layer.in) }
    })

export interface LayerFileDecl {
  /** The file, relative to the tsconfig directory. */
  readonly file: string
  readonly location: Location
  /** The Tags its Layer provides and requires, by name. */
  readonly provides: readonly string[]
  readonly requires: readonly string[]
}

export interface LayerFileReport {
  /**
   * The Layer Files whose default export is a Layer, in composition order: each after the files providing what it
   * requires, files that do not depend on each other by path codepoint, and those in a cycle last.
   */
  readonly layerFiles: readonly LayerFileDecl[]
  /** The server directory's `_app.ts`, and whether it exports `onError`. */
  readonly serverRoot: { readonly file: string; readonly onError: boolean } | undefined
  readonly errors: readonly AnalyzeError[]
}

/** `serverDir` (default `server`) is relative to the tsconfig directory. */
export function analyzeLayerFiles(opts: { readonly project: string; readonly serverDir?: string }): LayerFileReport {
  const { root, program, checker } = programOf(opts.project)
  const serverDir = path.resolve(root, opts.serverDir ?? 'server')
  const sources = programSourcesOf(program, root)
  const errors: AnalyzeError[] = []
  const report = (code: AnalyzeCode, n: ts.Node, message: string) =>
    errors.push(analyzeError(code, message, locationOf(root, n)))
  const rel = (sf: ts.SourceFile) => path.relative(root, sf.fileName)
  const name = (t: ts.Type) => t.getSymbol()?.getName() ?? checker.typeToString(t)
  /** A Tag by its declaration, so two imports of one Tag are one. */
  const key = (t: ts.Type): unknown => t.getSymbol() ?? t

  /** By path codepoint. */
  const files: LayerFileTags[] = []
  for (const f of readLayerFiles(sources, checker).sort((a, b) => (a.sf.fileName < b.sf.fileName ? -1 : 1)))
    if ('shape' in f) report('ServerFileShape', f.at, `Layer File "${rel(f.sf)}" ${f.shape}`)
    else files.push(f)

  const providers = new Map<unknown, LayerFileTags>()
  const conflicted = new Set<unknown>()
  for (const f of files)
    for (const t of f.provides) {
      const other = providers.get(key(t))
      if (!other) providers.set(key(t), f)
      else {
        conflicted.add(key(t))
        report(
          'LayerFileConflict',
          f.at,
          `Tag "${name(t)}" is provided by two Layer Files: "${rel(other.sf)}" and "${rel(f.sf)}"`,
        )
      }
    }
  /** The files providing what `f` requires, by path; a Tag two files provide has no one provider. */
  const deps = new Map(
    files.map((f) => {
      const keys = f.requires.map(key).filter((k) => !conflicted.has(k))
      return [f, files.filter((g) => keys.some((k) => providers.get(k) === g))]
    }),
  )
  for (const f of files)
    for (const t of f.requires)
      if (!providers.has(key(t)))
        report(
          'MissingDependency',
          f.at,
          `Layer File "${rel(f.sf)}" requires "${name(t)}", which no Layer File provides`,
        )

  // Each cycle once, at the file where the walk closes it.
  const state = new Map<LayerFileTags, 'active' | 'done'>()
  const walk = (f: LayerFileTags, stack: LayerFileTags[]) => {
    state.set(f, 'active')
    stack.push(f)
    for (const d of deps.get(f)!)
      if (state.get(d) === 'active')
        report(
          'LayerFileCycle',
          f.at,
          `Layer File cycle: ${[...stack.slice(stack.indexOf(d)), d].map((x) => rel(x.sf)).join(' -> ')}`,
        )
      else if (!state.has(d)) walk(d, stack)
    stack.pop()
    state.set(f, 'done')
  }
  for (const f of files) if (!state.has(f)) walk(f, [])

  // The first file, by path, whose providers are all placed; what a cycle holds back goes last.
  const pending = [...files]
  const placed = new Set<LayerFileTags>()
  for (;;) {
    const i = pending.findIndex((f) => deps.get(f)!.every((d) => placed.has(d)))
    if (i < 0) break
    placed.add(pending.splice(i, 1)[0]!)
  }
  const layerFiles = [...placed, ...pending].map((f) => ({
    file: rel(f.sf),
    location: locationOf(root, f.at),
    provides: f.provides.map(name),
    requires: f.requires.map(name),
  }))

  const rootFile = sources.find((sf) => path.resolve(sf.fileName) === path.join(serverDir, SERVER_ROOT))
  let serverRoot: LayerFileReport['serverRoot']
  if (rootFile) {
    const module = checker.getSymbolAtLocation(rootFile)
    const exports = module ? checker.getExportsOfModule(module) : []
    const values = exports.filter(
      // A type export is erased: never read.
      (e) => (e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e).flags & ts.SymbolFlags.Value,
    )
    for (const e of values)
      if (e.name !== 'onError')
        report(
          'ServerFileShape',
          e.declarations?.[0] ?? rootFile,
          `Server Root "${rel(rootFile)}" exports "${e.name}"; it takes only onError`,
        )
    serverRoot = { file: rel(rootFile), onError: values.some((e) => e.name === 'onError') }
  }
  return { layerFiles, serverRoot, errors }
}
