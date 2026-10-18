/** @jsxImportSource @sleekstack/ui */
import { match } from '@sleekstack/router'
import { Head } from '@sleekstack/ui'
import { ogMeta } from '@sleekstack/ui-vite/og-meta'
import { Layer } from 'effect'
import { pages, routes } from 'virtual:sleek-content'
import metaJson from '../content/docs/meta.json'
import { DocsLayout } from './layout/DocsLayout'
import { buildNav } from './layout/nav'
import { themeScript } from './layout/theme'
import './styles.css'

type Frontmatter = { title: string; description?: string }

const names = Object.keys(routes)
// A name another page nests under is a folder's own page (`api` beside `api/core`): the nav calls it `api/index`.
const slugOf = (name: string) =>
  names.some((n) => n.startsWith(`${name}/`)) ? [...name.split('/'), 'index'] : name.split('/')

let nav: Promise<ReturnType<typeof buildNav>> | undefined
const navTree = () =>
  (nav ??= Promise.all(
    names.map(async (name) => ({ slug: slugOf(name), title: (await pages[name]!()).frontmatter.title })),
  ).then((entries) => buildNav(metaJson, entries, import.meta.env.VITE_DOCS_BASE)))

/** The page for `path` in its layout, as the server entry and the browser entry both build it. */
export const site = async (path: string) => {
  const m = match(routes, path)
  if (m._tag === 'None') throw new Error(`no route ${path}`)
  const { default: Page, frontmatter } = await pages[m.value.name]!()
  const { title, description } = frontmatter as Frontmatter
  const tree = await navTree()
  const app = (
    <>
      <script>{themeScript}</script>
      <DocsLayout
        title={metaJson.title}
        tree={tree}
        current={path}
        home={routes.index ?? path}
        indexUrl={`${import.meta.env.BASE_URL}search-index.json`}
      >
        <Head>
          <title>{`${title} | ${metaJson.title}`}</title>
          {description && <meta name="description" content={description} />}
          {ogMeta({
            site: import.meta.env.VITE_DOCS_SITE,
            path,
            name: m.value.name,
            title,
            description,
            base: import.meta.env.BASE_URL,
          }).map((t) => (
            <meta {...t} />
          ))}
        </Head>
        <h1>{title}</h1>
        {description && <p class="lead">{description}</p>}
        <Page />
      </DocsLayout>
    </>
  )
  return { app, layer: Layer.empty }
}
