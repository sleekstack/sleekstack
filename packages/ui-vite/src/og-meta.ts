// No Node imports: safe in the browser entry.
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/** The image of a page: its name under `/og/`, which is also its output path without the leading slash. */
export const ogImagePath = (name: string) => `/og/${name}.png`

export type OgMetaInput = {
  /** Origin of the site; required, a relative `og:image` is not a valid card. */
  site: string
  /** The page's route path, `/guide/a`. */
  path: string
  /** The page's route name, as the plugin names its image (`index` for the root). */
  name: string
  title: string
  description?: string
  /** Vite's `base`. Default `/`. */
  base?: string
  /** `false` when the plugin's images are off: no `og:image` tags and a `summary` card. */
  image?: boolean
}

/**
 * The Open Graph and Twitter card tags of a page as `<meta>` props, for the page's `<Head>`:
 * `{ogMeta(...).map((m) => <meta {...m} />)}`. Fails when an image is wanted and `site` is empty.
 */
export const ogMeta = ({ site, path, name, title, description, base = '/', image = true }: OgMetaInput) => {
  if (!site) throw new Error('og: `site` (the origin the site is served from) is required for an absolute og:image')
  const origin = site.replace(/\/$/, '')
  const tags: ({ property: string; content: string } | { name: string; content: string })[] = [
    { property: 'og:title', content: title },
    ...(description ? [{ property: 'og:description', content: description }] : []),
    { property: 'og:url', content: `${origin}${path}` },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
  ]
  if (image)
    tags.push(
      { property: 'og:image', content: `${origin}${base.replace(/\/$/, '')}${ogImagePath(name)}` },
      { property: 'og:image:width', content: String(OG_WIDTH) },
      { property: 'og:image:height', content: String(OG_HEIGHT) },
      { property: 'og:image:alt', content: title },
    )
  return tags
}
