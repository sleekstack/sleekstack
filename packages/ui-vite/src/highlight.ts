import { createHash } from 'node:crypto'
import type { Element, Root } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import { bundledLanguages, isSpecialLang } from 'shiki'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

export const THEMES = { light: 'github-light', dark: 'github-dark' } as const

const BASE_CSS =
  '.shiki{background-color:var(--shiki-light-bg)}' +
  '.shiki span{color:var(--shiki-light)}' +
  '@media (prefers-color-scheme:dark){.shiki{background-color:var(--shiki-dark-bg)}.shiki span{color:var(--shiki-dark)}}'

/** Fails on a fence language shiki does not know, naming the page and line. */
export const remarkKnownFenceLanguage = () => (tree: MdastRoot, file: VFile) => {
  visit(tree, 'code', (node) => {
    if (node.lang && !isSpecialLang(node.lang) && !(node.lang in bundledLanguages)) {
      file.fail(`unknown code fence language "${node.lang}"`, node)
    }
  })
}

/** Collects the styles hoisted into classes; `css()` is the one stylesheet for every page compiled with it. */
export const createStyleSheet = () => {
  const rules = new Map<string, string>()
  const rehypeStyleToClass = () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const style = node.properties.style
      if (typeof style !== 'string') return
      const cls = `st-${createHash('sha1').update(style).digest('hex').slice(0, 8)}`
      rules.set(cls, style)
      delete node.properties.style
      const { class: plain, className } = node.properties
      node.properties.className = [
        ...String(plain ?? '').split(' '),
        ...((className as string[] | undefined) ?? []),
        cls,
      ].filter(Boolean)
      delete node.properties.class
    })
  }
  const css = () => BASE_CSS + [...rules].map(([cls, style]) => `.${cls}{${style}}`).join('')
  return { rehypeStyleToClass, css }
}
