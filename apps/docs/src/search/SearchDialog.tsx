/** @jsxImportSource @sleekstack/ui */
import { useEffect, useLocal, useRef } from '@sleekstack/ui'
import { loadSearchIndex, search, type SearchIndex } from '@sleekstack/ui-vite/search-client'

type Load = { status: 'idle' | 'loading' } | { status: 'ready'; index: SearchIndex } | { status: 'error' }

/**
 * The search trigger and its cmd-K modal dialog. The index loads on first open; the keyboard opens (cmd or ctrl K),
 * closes (escape, anywhere in the dialog), moves (arrows) and navigates (enter). Tab wraps inside the dialog, and
 * closing returns focus to the trigger.
 */
export const SearchDialog = function* ({
  indexUrl,
  fetcher,
  navigate = (url: string) => location.assign(url),
}: {
  indexUrl: string
  fetcher?: typeof fetch
  navigate?: (url: string) => void
}) {
  const [open, setOpen] = yield* useLocal(false)
  const [query, setQuery] = yield* useLocal('')
  const [active, setActive] = yield* useLocal(0)
  const [load, setLoad] = yield* useLocal<Load>({ status: 'idle' })
  const input = yield* useRef<HTMLInputElement>()
  const trigger = yield* useRef<HTMLButtonElement>()
  const dialog = yield* useRef<HTMLDivElement>()
  const opened = yield* useRef(false)

  yield* useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  yield* useEffect(() => {
    if (!open) {
      if (opened.current) trigger.current?.focus()
      return
    }
    opened.current = true
    input.current?.focus()
    if (load.status !== 'idle') return
    setLoad({ status: 'loading' })
    loadSearchIndex(indexUrl, fetcher).then(
      (index) => setLoad({ status: 'ready', index }),
      () => setLoad({ status: 'error' }),
    )
  }, [open])

  const results = load.status === 'ready' ? search(load.index, query) : []
  const close = () => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }
  const go = (url: string) => {
    close()
    navigate(url)
  }
  const onDialogKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('input, a[href], button') ?? [])]
      const edge = e.shiftKey ? focusable[0] : focusable[focusable.length - 1]
      if (focusable.length && (document.activeElement === edge || !dialog.current!.contains(document.activeElement))) {
        e.preventDefault()
        ;(e.shiftKey ? focusable[focusable.length - 1] : focusable[0])!.focus()
      }
    }
  }
  const onInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
    } else if (e.key === 'Enter' && results[active]) go(results[active].anchor)
  }

  return (
    <div class="search">
      <button ref={trigger} type="button" class="search-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Search
      </button>
      {open && (
        <div class="search-overlay" onClick={close}>
          <div
            ref={dialog}
            class="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            onClick={(e: Event) => e.stopPropagation()}
            onKeyDown={onDialogKeyDown}
          >
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-label="Search"
              aria-expanded="true"
              aria-controls="search-results"
              value={query}
              onInput={(e: Event) => {
                setQuery((e.target as HTMLInputElement).value)
                setActive(0)
              }}
              onKeyDown={onInputKeyDown}
            />
            {load.status === 'error' && <p role="alert">The search index could not be loaded.</p>}
            {load.status === 'loading' && <p role="status">Loading…</p>}
            {query.trim() !== '' && load.status === 'ready' && results.length === 0 && (
              <p role="status">No results for "{query}".</p>
            )}
            <ul id="search-results" role="listbox" aria-label="Results">
              {results.map((r, i) => (
                <li key={r.anchor} role="option" aria-selected={i === active ? 'true' : 'false'}>
                  <a href={r.anchor} onClick={close}>
                    <strong>{r.heading ? `${r.title} › ${r.heading}` : r.title}</strong>
                    <span>{r.snippet}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
