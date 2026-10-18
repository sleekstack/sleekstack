/** @jsxImportSource @sleekstack/ui */
import { match } from '@sleekstack/router'
import { Head } from '@sleekstack/ui'
import { Layer } from 'effect'
import { pages, routes } from 'virtual:sleek-content'

/** The page for `path`, as the server entry and the browser entry both build it. */
export const site = async (path: string) => {
  const m = match(routes, path)
  if (m._tag === 'None') throw new Error(`no route ${path}`)
  const { default: Page, frontmatter } = await pages[m.value.name]!()
  const app = (
    <main>
      <Head>
        <title>{frontmatter.title}</title>
        <meta property="og:title" content={frontmatter.title} />
      </Head>
      <Page />
    </main>
  )
  return { app, layer: Layer.empty }
}
