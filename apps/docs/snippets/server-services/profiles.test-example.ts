import { callService } from '@sleekstack/testing'
import { Effect, Exit, Layer } from 'effect'
import services from 'virtual:sleek/server-registry'
import { expect, it } from 'vitest'
import { NameTaken, Profiles } from './profiles'

const Taken = Layer.succeed(Profiles, {
  rename: ({ name }) => Effect.fail(new NameTaken({ name })),
  count: () => Effect.succeed(1),
})

it('plain DI: a test Layer replaces the implementation', async () => {
  const count = Effect.flatMap(Profiles, (profiles) => profiles.count())
  expect(await Effect.runPromise(Effect.provide(count, Taken))).toBe(1)
})

it('callService: the same Layer behind the wire, through start(...).fetch', async () => {
  const profiles = services.find((entry) => entry.tag === Profiles)!
  expect(await callService(profiles, 'rename', { name: 'ada' }, { layer: Taken })).toEqual(
    Exit.fail(new NameTaken({ name: 'ada' })),
  )
})
