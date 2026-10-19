import { Effect, Either, Schema } from 'effect'
import { expect, it } from 'vitest'
import { Ids, type Profile, ProfileDraft, ProfileModel } from './profile'

const ada: Profile = { id: 'p1', name: 'Ada', age: 36, country: 'United Kingdom' }
const isValid = (d: unknown) => Either.isRight(Schema.decodeUnknownEither(ProfileDraft.schema())(d))

it('fromDto resolves the country from ctx', () => {
  const dto = { id: 'p1', name: 'Ada', age: 36, country: 'gb' }
  expect(ProfileModel.fromDto(dto, { countries: { gb: 'United Kingdom' } })).toEqual(ada)
})

it('toDto of the seed is the write body', () => {
  const body = ProfileDraft.toDto(ProfileDraft.create(ada), ada).pipe(Effect.provideService(Ids, { next: () => 'r1' }))
  expect(Effect.runSync(body)).toEqual({ id: 'p1', requestId: 'r1', name: 'Ada', age: 36 })
})

it('the seed of an edit Draft is valid', () => {
  expect(isValid(ProfileDraft.create(ada))).toBe(true)
})

it('rejects an age that is blank or too long to convert', () => {
  expect(isValid({ name: 'Ada', age: '' })).toBe(false)
  expect(isValid({ name: 'Ada', age: '9'.repeat(400) })).toBe(false)
})
