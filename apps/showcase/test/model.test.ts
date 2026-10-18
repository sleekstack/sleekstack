// @vitest-environment jsdom
import { flush, render } from '@sleekstack/testing'
import { renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { ViewerLive } from '../src/layers'
import { ModelDraftDemo } from '../src/pages/model'

const app = () => jsx(ModelDraftDemo, {})
const layer = ViewerLive('u1')

/** Seed, pristine re-seed, edited keep, per-field errors, a ParseError in the Result, reset, then a save. */
const editAndSave = async (container: HTMLElement) => {
  const q = <E extends Element = HTMLElement>(s: string) => container.querySelector<E>(s)
  const text = (s: string) => q(s)?.textContent
  const input = (s: string) => q<HTMLInputElement>(s)!.value
  const type = async (s: string, value: string) => {
    q<HTMLInputElement>(s)!.value = value
    await act(async () => void q(s)!.dispatchEvent(new Event('input', { bubbles: true })))
    await flush()
  }
  const click = async (s: string) => {
    await act(async () => q(s)!.click())
    await flush()
  }
  const otherSave = () => click('button.external')

  expect(text('.record')).toBe('On the server: Ada Lovelace, 36, United Kingdom. Saved by Ada')
  expect([input('input.name'), input('input.age')]).toEqual(['Ada Lovelace', '36'])
  expect(q<HTMLButtonElement>('button.save')!.disabled).toBe(true)

  await otherSave()
  expect(text('.record')).toBe('On the server: Ada Lovelace, 37, United Kingdom. Saved by Linus')
  expect(input('input.age')).toBe('37') // pristine: re-seeded

  await type('input.name', 'Ada King')
  expect(text('.preview')).toBe('Preview: Ada King, 37, United Kingdom')
  await otherSave()
  expect(text('.record')).toContain('Ada Lovelace, 38')
  expect([input('input.name'), input('input.age')]).toEqual(['Ada King', '37']) // edited: kept

  await type('input.age', '9'.repeat(400)) // digits only, but Number() of it is Infinity
  await type('input.name', ' ')
  expect([text('.name-error'), text('.age-error')]).toEqual(['Enter a name', 'Enter an age from 0 to 150'])
  expect(text('.preview')).toBe('Preview:  , 38, United Kingdom') // an invalid age previews the saved one
  await act(async () => q<HTMLFormElement>('form.draft')!.requestSubmit())
  await flush()
  expect(text('.not-saved')).toBe('Not saved: fix the fields above')

  await click('button.reset')
  expect([input('input.name'), input('input.age')]).toEqual(['Ada Lovelace', '38'])
  expect(q('.name-error')).toBeNull()
  expect(q<HTMLButtonElement>('button.save')!.disabled).toBe(true)

  await type('input.name', 'Ada King')
  await act(async () => q<HTMLFormElement>('form.draft')!.requestSubmit())
  expect(text('button.save')).toBe('Saving')
  expect(q<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true)
  await vi.waitFor(() => expect(text('.record')).toBe('On the server: Ada King, 38, United Kingdom. Saved by Ada'))
  await flush()
  expect(q('.not-saved')).toBeNull()
  expect([input('input.name'), q<HTMLButtonElement>('button.save')!.disabled]).toEqual(['Ada King', true])
}

it('edits a Draft of the Model: re-seed while pristine, keep edits, errors, reset, and a save through toDto()', async () => {
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer, onError })
  await editAndSave(container)
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})

it('records: a post follows its author through related, and a save of the user updates every view', async () => {
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer, onError })
  const q = <E extends Element = HTMLElement>(s: string) => container.querySelector<E>(s)
  const text = (s: string) => q(s)?.textContent
  const type = async (value: string) => {
    q<HTMLInputElement>('input.user-name')!.value = value
    await act(async () => void q('input.user-name')!.dispatchEvent(new Event('input', { bubbles: true })))
    await flush()
  }
  const submit = async () => {
    await act(async () => q<HTMLFormElement>('form.user-draft')!.requestSubmit())
    await flush()
  }

  await vi.waitFor(() => expect(text('.user')).toBe('User: Ada Lovelace'))
  expect(text('.post')).toBe('Notes on the Engine, by Ada Lovelace')
  expect(q<HTMLButtonElement>('button.user-save')!.disabled).toBe(true)

  await type('')
  expect(text('.user-error')).toBe('Enter a name')
  await submit()
  expect(text('.user')).toBe('User: Ada Lovelace') // a failed commit writes nothing

  await type('Ada King')
  await act(async () => q<HTMLFormElement>('form.user-draft')!.requestSubmit())
  expect(text('button.user-save')).toBe('Saving')
  expect(text('.post')).toBe('Notes on the Engine, by Ada Lovelace') // pessimistic: nothing before the acknowledgement
  await vi.waitFor(() => expect(text('.user')).toBe('User: Ada King'))
  await flush()
  expect(text('.post')).toBe('Notes on the Engine, by Ada King')
  expect([q<HTMLInputElement>('input.user-name')!.value, q<HTMLButtonElement>('button.user-save')!.disabled]).toEqual([
    'Ada King',
    true,
  ]) // the Draft's baseline moved to the saved user
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})

it('renders the seeded form on the server; after hydration the same flow works', async () => {
  const html = await renderToString(app(), { layer })
  expect(html).toContain('value="Ada Lovelace"')
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer, hydrate: html, onError })
  await editAndSave(container)
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})
