import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { OG_HEIGHT, OG_WIDTH } from './og-meta.js'

export type OgFont = {
  /** Font file (TTF, OTF, WOFF), relative to the project root. */
  file: string
  name: string
  weight?: 400 | 700
}

export type OgOptions = {
  /** Origin the page is served from, such as `https://docs.example.com`; `og:image` is an absolute URL on it. */
  site: string
  fonts: OgFont[]
}

type Font = { name: string; data: Buffer; weight: 400 | 700 }

/** Reads the font files; a missing one fails with its path. */
export const loadFonts = (fonts: readonly OgFont[], root: string): Font[] => {
  if (fonts.length === 0) throw new Error('og: at least one font file is required to draw text')
  return fonts.map((f) => {
    const file = resolve(root, f.file)
    try {
      return { name: f.name, data: readFileSync(file), weight: f.weight ?? 400 }
    } catch (e) {
      throw new Error(`og: cannot read font file ${file}: ${(e as Error).message}`, { cause: e })
    }
  })
}

const box = (style: Record<string, unknown>, children: unknown) => ({ type: 'div', props: { style, children } })

/** One 1200 by 630 PNG: title and description on a plain card. Text is drawn as paths, so rasterizing needs no fonts. */
export const renderOgPng = async (card: { title: string; description?: string }, fonts: Font[]): Promise<Buffer> => {
  const tree = box(
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      padding: 80,
      background: '#0b0d12',
      color: '#f4f5f7',
    },
    [
      box({ fontSize: 72, fontWeight: 700, lineHeight: 1.15 }, card.title),
      ...(card.description
        ? [box({ fontSize: 34, marginTop: 28, color: '#a3a8b5', lineHeight: 1.3 }, card.description)]
        : []),
    ],
  )
  const svg = await satori(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts.map((f) => ({ ...f, style: 'normal' as const })),
  })
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng()
}

const field = (block: string, key: string) =>
  new RegExp(`^${key}:\\s*["']?(.*?)["']?\\s*$`, 'm').exec(block)?.[1] || undefined

/** `title` and `description` from a page's leading `---` block. */
export const frontmatterOf = (source: string) => {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? ''
  return { title: field(block, 'title'), description: field(block, 'description') }
}
