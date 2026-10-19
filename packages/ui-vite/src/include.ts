import { readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

const textOf = (node: { value?: string; children?: unknown[] }): string =>
  typeof node.value === 'string' ? node.value : (node.children ?? []).map((c) => textOf(c as never)).join('')

/** Expands `<include>path</include>` (path relative to the page) into a code block of that file. */
export const remarkInclude = () => (tree: Root, file: VFile) => {
  visit(tree, (node, index, parent) => {
    const el = node as { type: string; name?: string; children?: unknown[] }
    if (el.name !== 'include' || !parent || index === undefined) return
    if (el.type !== 'mdxJsxFlowElement' && el.type !== 'mdxJsxTextElement') return
    const rel = textOf(el as never).trim()
    const abs = resolve(dirname(file.path ?? '.'), rel)
    let value: string
    try {
      value = readFileSync(abs, 'utf8').replace(/\n$/, '')
    } catch {
      return file.fail(`include file not found: ${rel}`, node)
    }
    parent.children[index] = { type: 'code', lang: extname(abs).slice(1) || null, value }
  })
}
