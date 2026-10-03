// @vitest-environment jsdom
import { renderToString, resume } from '@sleekstack/ui'
import { Effect, Layer } from 'effect'
import { expect, it, vi } from 'vitest'
import { countAtom } from '../src/resume/count'
import { Counter } from '../src/resume/counter'
import increment from '../src/resume/increment'

it('resumes the server-rendered counter without component calls; a click loads the handler lazily', async () => {
  const component = vi.fn(Counter)
  const container = document.createElement('div')
  container.innerHTML = await renderToString(Effect.suspend(component), { layer: Layer.empty })
  document.body.append(container)
  component.mockClear()
  const load = vi.fn(async () => ({ default: increment }))
  const h = await resume({ container, layer: Layer.empty, handlers: { increment: load }, atoms: { count: countAtom } })
  expect(load).not.toHaveBeenCalled()
  const out = container.querySelector('output')!
  expect(out.textContent).toBe('0')
  const btn = container.querySelector('button')!
  btn.click()
  btn.click()
  await vi.waitFor(() => expect(out.textContent).toBe('2'))
  expect(load).toHaveBeenCalledTimes(1)
  expect(component).not.toHaveBeenCalled()
  await h.dispose()
})
