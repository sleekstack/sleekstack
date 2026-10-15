// @vitest-environment jsdom
import { renderToString, resume } from '@sleekstack/ui'
import { Effect, Layer } from 'effect'
import { expect, it, vi } from 'vitest'
import { countAtom } from '../src/resume/count'
import { Counter } from '../src/resume/counter'
import increment from '../src/resume/increment'
import set from '../src/resume/set'

// Server-renders the counter, then resumes it with no component calls; each handler loads on its first event.
const resumeCounter = async () => {
  const component = vi.fn(Counter)
  const container = document.createElement('div')
  container.innerHTML = await renderToString(Effect.suspend(component), { layer: Layer.empty })
  document.body.append(container)
  component.mockClear()
  const handlers = {
    increment: vi.fn(async () => ({ default: increment })),
    set: vi.fn(async () => ({ default: set })),
  }
  const h = await resume({ container, layer: Layer.empty, handlers, atoms: [countAtom] })
  expect(handlers.increment).not.toHaveBeenCalled()
  expect(handlers.set).not.toHaveBeenCalled()
  const out = container.querySelector('output')!
  expect(out.textContent).toBe('0')
  return { container, handlers, out, component, dispose: async () => (await h.dispose(), container.remove()) }
}

it('resumes the server-rendered counter without component calls; a click loads the handler lazily', async () => {
  const { container, handlers, out, component, dispose } = await resumeCounter()
  const btn = container.querySelector('button')!
  btn.click()
  btn.click()
  await vi.waitFor(() => expect(out.textContent).toBe('2'))
  expect(handlers.increment).toHaveBeenCalledTimes(1)
  expect(component).not.toHaveBeenCalled()
  await dispose()
})

it('the counter form resumes too: a submit loads its action lazily and sets the count from the form data', async () => {
  const { container, handlers, out, component, dispose } = await resumeCounter()
  container.querySelector<HTMLInputElement>('input[name="to"]')!.value = '7'
  container.querySelector('form')!.requestSubmit()
  await vi.waitFor(() => expect(out.textContent).toBe('7'))
  expect(handlers.set).toHaveBeenCalledTimes(1)
  expect(component).not.toHaveBeenCalled()
  await dispose()
})
