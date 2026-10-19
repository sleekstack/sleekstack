import { readFileSync } from 'node:fs'
import { createProcessor } from '@mdx-js/mdx'
import GithubSlugger from 'github-slugger'
import type { Root, RootContent } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { SKIP, visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import type { SearchEntry, SearchIndex } from './search-client.js'
import type { ContentPage } from './content-routes.js'

const plain = (node: RootContent | Root): string => {
  let out = ''
  visit(node, (n) => {
    if ((n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement') && n.name === 'include') return SKIP
    if ('value' in n && ['text', 'inlineCode', 'code'].includes(n.type)) out += `${n.value} `
    return undefined
  })
  return out.replace(/\s+/g, ' ').trim()
}

const frontmatterTitle = (tree: Root) => {
  const yaml = tree.children.find((n) => n.type === 'yaml')
  return /^title:\s*["']?(.*?)["']?\s*$/m.exec(yaml && 'value' in yaml ? yaml.value : '')?.[1]
}

/** The sections of one page's source: the text before the first heading, then one entry per heading, ids as the page renders them. */
export const searchEntries = (source: string, path: string, file = path): SearchEntry[] => {
  const tree = createProcessor({ remarkPlugins: [remarkFrontmatter, remarkGfm] }).parse(
    new VFile({ path: file, value: source }),
  ) as Root
  const slugger = new GithubSlugger()
  const first = tree.children.find((n) => n.type === 'heading')
  const title = frontmatterTitle(tree) ?? (first ? plain(first) : path)
  const entries: SearchEntry[] = []
  let cur: SearchEntry = { title, heading: '', anchor: path, text: '' }
  const close = () => (cur.text || cur.heading) && entries.push(cur)
  for (const node of tree.children) {
    if (node.type === 'heading') {
      close()
      const heading = plain(node)
      cur = { title, heading, anchor: `${path}#${slugger.slug(heading)}`, text: '' }
    } else cur.text = `${cur.text} ${plain(node)}`.trim()
  }
  close()
  return entries
}

/** The index for `pages`, read from their source files. */
export const buildSearchIndex = (pages: readonly ContentPage[]): SearchIndex => ({
  version: 1,
  entries: pages.flatMap((p) => searchEntries(readFileSync(p.file, 'utf8'), p.path, p.file)),
})
