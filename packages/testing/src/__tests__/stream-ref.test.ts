import { el, Pending, renderToStream, useEffect, useLocal, useRef } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { within } from '@testing-library/dom'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { flush, render } from '../index'

// What a browser does with streamed HTML: parse it, then run the inline scripts (the boundary swaps) in order.
const browserApply = (html: string): string => {
  const scratch = document.body.appendChild(document.createElement('div'))
  scratch.innerHTML = html
  for (const s of [...scratch.querySelectorAll('script:not([type])')]) {
    s.remove()
    new Function(s.textContent!)()
  }
  const out = scratch.innerHTML
  scratch.remove()
  return out
}

describe('streaming output and refs', () => {
  it('hydrates streamed HTML: the resolved boundary replaces its fallback', async () => {
    const Slow = () =>
      Effect.as(
        Effect.promise(() => Promise.resolve()),
        el('b', {}, 'done'),
      )
    const app = jsx('div', {
      children: [
        jsx('p', { children: 'head' }),
        jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Slow, {}) }),
      ],
    })
    const html = await new Response(renderToStream(app, { layer: Layer.empty })).text()
    expect(html).toContain('data-sleek-b=')
    const { container } = await render(app, { layer: Layer.empty, hydrate: browserApply(html) })
    await flush()
    expect(within(container).getByText('head')).toBeDefined()
    expect(within(container).getByText('done')).toBeDefined()
    expect(within(container).queryByText('wait')).toBeNull()
  })

  it('a ref points at its host element while mounted and is nulled on dispose', async () => {
    let box!: { current: HTMLElement | null | undefined }
    const C = () =>
      Effect.flatMap(useRef<HTMLElement>(), (ref) => ((box = ref), jsx('button', { ref, children: 'go' })))
    const { container, dispose } = await render(jsx(C, {}), { layer: Layer.empty })
    await flush()
    expect(box.current).toBe(within(container).getByRole('button'))
    await dispose()
    expect(box.current).toBeNull()
  })
})

describe('flush', () => {
  it('waits for a re-render that a post-commit effect schedules on a timer', async () => {
    const Delayed = () =>
      Effect.flatMap(useLocal('before'), ([text, set]) =>
        Effect.as(
          useEffect(
            () =>
              Effect.zipRight(
                Effect.sleep(8),
                Effect.sync(() => set('after')),
              ),
            [],
          ),
          el('p', {}, text),
        ),
      )
    const { container } = await render(jsx(Delayed, {}), { layer: Layer.empty })
    await flush()
    expect(within(container).getByText('after')).toBeDefined()
  })
})
