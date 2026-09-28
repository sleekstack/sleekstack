// TypeDoc -> markdown -> content/docs/api/<pkg>/<entry>.md, one page per entry point.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Application } from 'typedoc'
import { headings } from './check-links.mjs'
import { repoRoot, resolveEntryPoints } from './entry-points.mjs'

/**
 * TypeDoc numbers duplicate anchors differently from Fumadocs, so an anchor that exists may still
 * name the wrong heading. Point each symbol link at the `### <symbol>` heading its text names
 * (exact name, `()` ignored); otherwise keep a valid anchor, else fall back to the symbol by slug.
 * Links to index.md become the entry point's site route.
 */
export function rewriteAnchors(raw, route) {
  const hs = headings(raw)
  const ids = new Set(hs.map((h) => h.id))
  const byName = new Map()
  for (const h of hs.filter((h) => h.depth === 3)) {
    const name = h.text.replace(/\(\)$/, '')
    byName.set(name, byName.has(name) ? null : h.id) // null = ambiguous
  }
  const bySlug = new Map(hs.filter((h) => h.depth === 3).map((h) => [h.id.replace(/-\d+$/, ''), h.id]))
  const fix = (text, frag) =>
    byName.get(text.replace(/[`*_]/g, '').replace(/\(\)$/, '')) ??
    (ids.has(frag) ? frag : (bySlug.get(frag.replace(/-\d+$/, '')) ?? frag))
  return raw
    .replace(/\[([^\]]*)\]\(#([^)]+)\)/g, (_, text, frag) => `[${text}](#${fix(text, frag)})`)
    .replace(/\[([^\]]*)\]\((?:\.\/)?index\.md(?:#([^)]*))?\)/g, (_, text, frag) => `[${text}](${route}${frag ? `#${fix(text, frag)}` : ''})`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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

    // Namespace exports (`export * as X`) get their own page at `<route>/<x>`; the entry page keeps a
    // `### X` entry with the namespace summary and a link to it.
    const out = join(outRoot, ep.pkg, `${ep.entry}.md`)
    const nsDir = ep.entry === 'index' ? join(outRoot, ep.pkg) : join(outRoot, ep.pkg, ep.entry)
    const nsFiles = readdirSync(tmp, { recursive: true, encoding: 'utf8' }).filter((f) => /(^|\/)namespaces\/[^/]+\.md$/.test(f))
    const nsRoute = (name) => `${ep.route}/${name.toLowerCase()}`
    let raw = readFileSync(join(tmp, 'index.md'), 'utf8')
    for (const f of nsFiles) {
      const name = basename(f, '.md')
      const nsRaw = readFileSync(join(tmp, f), 'utf8')
      const summary = nsRaw.split(/^## /m)[0].trim()
      raw = raw.replace(`- [${name}](${f})`, `### ${name}\n\n${summary}\n\nSee [${name}](${nsRoute(name)}).\n`).replaceAll(`](${f}`, `](${nsRoute(name)}`)
      const nsBody = rewriteAnchors(
        nsRaw
          .replace(/\]\((?:\.\.\/)+index\.md/g, '](index.md')
          .replace(/\]\((?!index\.md)([A-Za-z0-9_]+)\.md(#[^)]*)?\)/g, (_, n, frag = '') => `](${nsRoute(n)}${frag})`),
        ep.route,
      )
      mkdirSync(nsDir, { recursive: true })
      writeFileSync(join(nsDir, `${name.toLowerCase()}.md`), `---\ntitle: "${ep.name}: ${name}"\ndescription: API reference for the ${name} namespace of ${ep.name}\n---\n\n${nsBody}`)
    }
    const body = rewriteAnchors(raw, ep.route)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `---\ntitle: "${ep.name}"\ndescription: API reference for ${ep.name}\n---\n\n${body}`)
  }
  rmSync(join(outRoot, '.tmp'), { recursive: true, force: true })

  writeFileSync(
    join(outRoot, 'index.mdx'),
    `---\ntitle: API reference\ndescription: Generated from TSDoc.\n---\n\n${entries.map((e) => `- [${e.name}](${e.route})`).join('\n')}\n`,
  )
  console.log(`generate:api: ${entries.length} entry points -> ${outRoot}`)
}
