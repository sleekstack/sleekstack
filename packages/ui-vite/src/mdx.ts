import { compile } from '@mdx-js/mdx'
import rehypeShiki from '@shikijs/rehype'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { VFile } from 'vfile'
import { createStyleSheet, remarkKnownFenceLanguage, THEMES } from './highlight.js'
import { remarkInclude } from './include.js'
import { type Rebase, remarkRebase } from './links.js'

export type CompileOptions = {
  /** Absolute path of the page; relative `<include>` paths resolve against it and errors name it. */
  file: string
  styles: ReturnType<typeof createStyleSheet>
  /** `function-body` is for `run()` in tests; the build wants the default `program`. */
  outputFormat?: 'program' | 'function-body'
  /** Swaps a leading `from` of every internal link for `to`, so content written for one prefix serves under another. */
  rebase?: Rebase
}

/** Compiles one page to a module exporting its component and `frontmatter`. Failures read `file:line: reason`. */
export const compileMdx = async (source: string, opts: CompileOptions): Promise<string> => {
  const vfile = new VFile({ path: opts.file, value: source })
  try {
    const out = await compile(vfile, {
      format: opts.file.endsWith('.md') ? 'md' : 'mdx',
      outputFormat: opts.outputFormat ?? 'program',
      jsxImportSource: '@sleekstack/ui',
      elementAttributeNameCase: 'html',
      tableCellAlignToStyle: false,
      remarkPlugins: [
        remarkFrontmatter,
        remarkMdxFrontmatter,
        remarkGfm,
        remarkInclude,
        remarkKnownFenceLanguage,
        ...(opts.rebase ? [remarkRebase(opts.rebase)] : []),
      ],
      rehypePlugins: [
        rehypeSlug,
        [rehypeShiki, { themes: THEMES, defaultColor: false, defaultLanguage: 'text' }],
        opts.styles.rehypeStyleToClass,
      ],
    })
    return String(out)
  } catch (e) {
    const m = e as { reason?: string; line?: number | null; message: string }
    throw new Error(`${opts.file}${m.line ? `:${m.line}` : ''}: ${m.reason ?? m.message}`, { cause: e })
  }
}
