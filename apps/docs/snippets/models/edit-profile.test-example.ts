import { Atom, makeAtomStore } from '@sleekstack/core'
import { flush, render } from '@sleekstack/testing'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Effect, Layer } from 'effect'
import { expect, it } from 'vitest'
import { EditProfile } from './edit-profile'
import { Ids, type Profile, type ProfilePatch, Profiles } from './profile'

const ada: Profile = { id: 'p1', name: 'Ada', age: 36, country: 'United Kingdom' }

const setup = async () => {
  const saved: Array<ProfilePatch> = []
  const layer = Layer.mergeAll(
    Layer.succeed(Ids, { next: () => 'r1' }),
    Layer.succeed(Profiles, { save: (patch) => Effect.sync(() => void saved.push(patch)) }),
  )
  // The test owns the Store, so it can write the Draft's source the way a refetch would.
  const store = makeAtomStore()
  const profile = Atom.make(ada)
  const { container } = await render(jsx(EditProfile, { profile }), { layer, store })
  const page = within(container)
  const [name, age] = page.getAllByRole('textbox') as Array<HTMLInputElement>
  return { saved, store, profile, page, name: name!, age: age! }
}

it('saves the edited Draft as the write body', async () => {
  const { saved, page, age } = await setup()
  await userEvent.clear(age)
  await userEvent.type(age, '37')
  await userEvent.click(page.getByRole('button', { name: 'Save' }))
  await flush()
  expect(saved).toEqual([{ id: 'p1', requestId: 'r1', name: 'Ada', age: 37 }])
})

it('shows the schema message for a blank age', async () => {
  const { page, age } = await setup()
  await userEvent.clear(age)
  await flush()
  expect(page.getByRole('alert').textContent).toBe('Enter an age from 0 to 999')
})

it('re-seeds from a new source while pristine, and keeps edits after', async () => {
  const { store, profile, name, age } = await setup()
  store.set(profile, { ...ada, age: 37 })
  await flush()
  expect(age.value).toBe('37')
  await userEvent.type(name, ' L')
  store.set(profile, { ...ada, age: 38 })
  await flush()
  expect([name.value, age.value]).toEqual(['Ada L', '37'])
})
