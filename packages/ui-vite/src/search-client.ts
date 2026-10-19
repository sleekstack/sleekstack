/** One searchable section of a page: the text under one heading (or before the first). */
export type SearchEntry = {
  /** The page title. */
  title: string
  /** The section heading; empty for the text before the first heading. */
  heading: string
  /** The section's URL: the page path, with `#id` for a heading section. */
  anchor: string
  text: string
}

export type SearchIndex = { version: 1; entries: SearchEntry[] }

export type SearchResult = { title: string; heading: string; anchor: string; snippet: string; score: number }

/** The index is absent or not a v1 index. Searching never treats this as "no results". */
export class SearchIndexMissing extends Error {
  override readonly name = 'SearchIndexMissing'
}

const SNIPPET = 140

const terms = (query: string) =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

const snippetOf = (text: string, ts: string[]) => {
  const lower = text.toLowerCase()
  const at = Math.min(...ts.map((t) => lower.indexOf(t)).filter((i) => i >= 0), text.length)
  const from = Math.max(0, at - 30)
  const cut = text.slice(from, from + SNIPPET).trim()
  return `${from > 0 ? '…' : ''}${cut}${from + SNIPPET < text.length ? '…' : ''}`
}

/**
 * Ranked results for `query`: an entry matches when every term occurs in its title, heading or text. A title hit
 * outranks a heading hit, which outranks a text hit. Empty query: `[]`. Missing or malformed index: throws
 * `SearchIndexMissing`.
 */
export const search = (index: SearchIndex | null | undefined, query: string, limit = 20): SearchResult[] => {
  if (!index || index.version !== 1 || !Array.isArray(index.entries)) throw new SearchIndexMissing('no search index')
  const ts = terms(query)
  if (ts.length === 0) return []
  const out: SearchResult[] = []
  for (const e of index.entries) {
    const [title, heading, text] = [e.title, e.heading, e.text].map((s) => s.toLowerCase()) as [string, string, string]
    if (!ts.every((t) => title.includes(t) || heading.includes(t) || text.includes(t))) continue
    const score = ts.reduce(
      (n, t) => n + (title.includes(t) ? 10 : 0) + (heading.includes(t) ? 5 : 0) + (text.includes(t) ? 1 : 0),
      0,
    )
    out.push({ title: e.title, heading: e.heading, anchor: e.anchor, snippet: snippetOf(e.text, ts), score })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Fetches and checks the index the build wrote (`search-index.json`). A failed request or a bad body throws `SearchIndexMissing`. */
export const loadSearchIndex = async (url: string, fetcher: typeof fetch = fetch): Promise<SearchIndex> => {
  const res = await fetcher(url).catch((e: unknown) => {
    throw new SearchIndexMissing(`${url}: ${(e as Error).message}`)
  })
  if (!res.ok) throw new SearchIndexMissing(`${url}: ${res.status}`)
  const index = (await res.json().catch(() => null)) as SearchIndex | null
  if (index?.version !== 1) throw new SearchIndexMissing(`${url}: not a search index`)
  return index
}
