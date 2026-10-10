// @vitest-environment jsdom
import { Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { type ActionEvent, defineHandler, mount, type Mounted, renderToString, resume, type Resumed } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const entries = (e: ActionEvent) => [...e.formData.entries()]

const formProps = (extra: Record<string, unknown>) => ({
  ...extra,
  children: [
    jsx('input', { name: 'title', value: 'hi' }),
    jsx('button', { id: 'save', name: 'intent', value: 'save' }),
  ],
})
const submit = (c: Element) => {
  const form = c.querySelector('form')!
  form.requestSubmit(c.querySelector<HTMLButtonElement>('#save')!)
}

let mounts: Array<Mounted | Resumed> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of mounts) await h.dispose()
  })
  mounts = []
  document.body.replaceChildren()
})
const go = async (props: Record<string, unknown>, onError = vi.fn()) => {
  const container = document.createElement('div')
  document.body.append(container)
  await act(
    async () =>
      void mounts.push(await mount(jsx('form', formProps(props)), { layer: Layer.empty, container, onError })),
  )
  return { container, onError }
}

describe('form action (closure)', () => {
  const seen: Array<unknown> = []
  afterEach(() => void (seen.length = 0))
  it.each([
    ['function', (e: ActionEvent) => void seen.push(entries(e))],
    [
      'generator',
      function* (e: ActionEvent) {
        yield* Effect.void
        seen.push(entries(e))
      },
    ],
    ['Effect-returning', (e: ActionEvent) => Effect.sync(() => void seen.push(entries(e)))],
  ])('a %s action gets the form data with the submitter, after onSubmit, default prevented', async (_, action) => {
    const order: Array<string> = []
    const { container } = await go({ action, onSubmit: () => void order.push('onSubmit') })
    const prevented = vi.fn()
    container.querySelector('form')!.addEventListener('submit', (e) => prevented(e.defaultPrevented))
    ;(container.querySelector('input') as HTMLInputElement).value = 'typed'
    submit(container)
    await flush()
    expect(order).toEqual(['onSubmit'])
    expect(seen).toEqual([
      [
        ['title', 'typed'],
        ['intent', 'save'],
      ],
    ])
    expect(prevented).toHaveBeenCalledWith(true)
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('typed') // no reset
  })

  it('an Effect value action runs on submit', async () => {
    const run = vi.fn()
    const { container } = await go({ action: Effect.sync(run) })
    submit(container)
    await flush()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('a Promise result is rejected with a clear error', async () => {
    const { container, onError } = await go({ action: async () => {} })
    submit(container)
    await flush()
    expect(String(onError.mock.calls[0]?.[0])).toMatch(/action returned a Promise: return an Effect or use a generator/)
  })

  it('a second submit interrupts the first', async () => {
    const log: Array<string> = []
    let n = 0
    const action = () => {
      const i = ++n
      return Effect.onInterrupt(
        Effect.zipRight(
          Effect.sleep(i === 1 ? '1 hour' : '0 millis'),
          Effect.sync(() => void log.push(`done ${i}`)),
        ),
        () => Effect.sync(() => void log.push(`interrupted ${i}`)),
      )
    }
    const { container, onError } = await go({ action })
    submit(container)
    submit(container)
    await flush()
    expect(log).toEqual(['interrupted 1', 'done 2'])
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('form action (resumed)', () => {
  it('gets the same form data as a closure; the server emits no form data', async () => {
    const seen: Array<unknown> = []
    const save = defineHandler('save', (e) => Effect.sync(() => void seen.push([...e.formData!.entries()])))
    const html = await renderToString(jsx('form', formProps({ action: save })), { layer: Layer.empty })
    expect(html).toContain('data-sleek-on-submit="save"')
    expect(html).toContain('data-sleek-pd-submit')
    expect(html).not.toMatch(/formData|intent=/)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    mounts.push(
      await resume({ container, layer: Layer.empty, handlers: { save: async () => ({ default: save }) }, atoms: [] }),
    )
    submit(container)
    await flush()
    expect(seen).toEqual([
      [
        ['title', 'hi'],
        ['intent', 'save'],
      ],
    ])
  })

  it('a second resumed submit interrupts the first', async () => {
    const log: Array<string> = []
    let n = 0
    const slow = defineHandler('slow', () => {
      const i = ++n
      return Effect.onInterrupt(
        Effect.zipRight(
          Effect.sleep(i === 1 ? '1 hour' : '0 millis'),
          Effect.sync(() => void log.push(`done ${i}`)),
        ),
        () => Effect.sync(() => void log.push(`interrupted ${i}`)),
      )
    })
    const container = document.createElement('div')
    container.innerHTML = await renderToString(jsx('form', formProps({ action: slow })), { layer: Layer.empty })
    document.body.append(container)
    const onError = vi.fn()
    mounts.push(
      await resume({
        container,
        layer: Layer.empty,
        handlers: { slow: async () => ({ default: slow }) },
        atoms: [],
        onError,
      }),
    )
    submit(container)
    await flush()
    submit(container)
    await flush()
    await flush()
    expect(log).toEqual(['interrupted 1', 'done 2'])
    expect(onError).not.toHaveBeenCalled()
  })
})
