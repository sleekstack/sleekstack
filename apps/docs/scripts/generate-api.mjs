// TypeDoc -> markdown -> content/docs/api/<pkg>/<entry>.md, one page per entry point.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Application } from 'typedoc'
import { headings } from './check-links.mjs'
import { repoRoot, resolveEntryPoints } from './entry-points.mjs'

const outRoot = join(dirname(fileURLToPath(import.meta.url)), '../content/docs/api')
rmSync(outRoot, { recursive: true, force: true })

const entries = resolveEntryPoints()
for (const ep of entries) {
  const tmp = join(outRoot, '.tmp', ep.pkg, ep.entry)
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [ep.file],
    tsconfig: join(repoRoot, 'packages', ep.pkg, 'tsconfig.json'),
    plugin: ['typedoc-plugin-markdown'],
    out: tmp,
    outputFileStrategy: 'modules',
    entryFileName: 'index',
    hidePageHeader: true,
    hideBreadcrumbs: true,
    hidePageTitle: true,
    readme: 'none',
    treatWarningsAsErrors: true,
    disableSources: true,
    excludeExternals: true,
    logLevel: 'Warn',
  })
  const project = await app.convert()
  if (!project || app.logger.hasErrors() || app.logger.hasWarnings()) throw new Error(`typedoc failed for ${ep.name}`)
  await app.generateOutputs(project)
  if (app.logger.hasErrors() || app.logger.hasWarnings()) throw new Error(`typedoc output failed for ${ep.name}`)

  const raw = readFileSync(join(tmp, 'index.md'), 'utf8')
  // TypeDoc numbers duplicate anchors differently from Fumadocs: point each symbol fragment at the
  // rendered id of its `### Symbol` heading. Any stray .md link becomes a site route.
  const hs = headings(raw)
  const ids = new Set(hs.map((h) => h.id))
  const symbolId = new Map(hs.filter((h) => h.depth === 3).map((h) => [h.id.replace(/-\d+$/, ''), h.id]))
  const fix = (frag) => (ids.has(frag) ? frag : symbolId.get(frag.replace(/-\d+$/, '')) ?? frag)
  const body = raw
    .replace(/\]\(#([^)]+)\)/g, (_, frag) => `](#${fix(frag)})`)
    .replace(/\]\((?:\.\/)?index\.md(?:#([^)]*))?\)/g, (_, frag) => `](${ep.route}${frag ? `#${fix(frag)}` : ''})`)
  const out = join(outRoot, ep.pkg, `${ep.entry}.md`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `---\ntitle: "${ep.name}"\ndescription: API reference for ${ep.name}\n---\n\n${body}`)
}
rmSync(join(outRoot, '.tmp'), { recursive: true, force: true })

writeFileSync(
  join(outRoot, 'index.mdx'),
  `---\ntitle: API reference\ndescription: Generated from TSDoc.\n---\n\n${entries.map((e) => `- [${e.name}](${e.route})`).join('\n')}\n`,
)
console.log(`generate:api: ${entries.length} entry points -> ${outRoot}`)
