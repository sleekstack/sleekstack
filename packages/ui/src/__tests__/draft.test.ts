// @vitest-environment jsdom
import { Atom, type DraftSpec, makeAtomStore, Result } from '@sleekstack/core'
import { Cause, Context, Data, Deferred, Effect, Either, Layer, Option, ParseResult, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  type Draft,
  mount,
  type Mounted,
  Store,
  useAction,
  useAtomValue,
  useDraft,
  useFormStatus,
  useOptimistic,
} from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

type Profile = { readonly name: string; readonly age: number }
type ProfileForm = { readonly name: string; readonly age: string }
type ProfileBody = { readonly name: string; readonly age: number; readonly at: number }

class Clock extends Context.Tag('Clock')<Clock, { readonly now: number }>() {}
class Rejected extends Data.TaggedError('Rejected')<{}> {}

const count = { decodes: 0, previews: 0, diffs: 0 }
const ProfileFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.filter((s) => (count.decodes++, s.trim() !== '' || 'Enter a name'))),
  age: Schema.String.pipe(Schema.pattern(/^\d+$/, { message: () => 'Enter a number' })),
})

const ProfileDraft = {
  schema: () => ProfileFormSchema,
  create: (m: Profile): ProfileForm => ({ name: m.name, age: String(m.age) }),
  toDto: (d: ProfileForm): Effect.Effect<ProfileBody, Rejected, Clock> =>
    d.name === 'reject'
      ? Effect.fail(new Rejected())
      : Effect.map(Clock, (c) => ({ name: d.name.trim(), age: Number(d.age), at: c.now })),
  toModel: (d: ProfileForm, m: Profile): Profile => (count.previews++, { name: d.name, age: Number(d.age) || m.age }),
  diff: (base: ProfileForm, next: ProfileForm): Partial<ProfileBody> => (
    count.diffs++,
    next.name === base.name ? {} : { name: next.name }
  ),
} satisfies DraftSpec<ProfileForm, ProfileBody, Profile, Profile, Rejected, Clock>
const Upper: typeof ProfileDraft = {
  ...ProfileDraft,
  create: (m) => ({ name: m.name.toUpperCase(), age: String(m.age) }),
}

type ProfileDraftAtoms = Draft<ProfileForm, ProfileBody, Profile, Rejected, Clock, true>
const clock = Layer.succeed(Clock, { now: 7 })

let mounts: Array<Mounted> = []
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

const go = async (app: any) => {
  const container = document.createElement('div')
  document.body.append(container)
  const store = makeAtomStore()
  await act(async () => void mounts.push(await mount(app, { layer: clock, container, store })))
  return { container, store, submit: () => act(() => container.querySelector('form')!.requestSubmit()) }
}

// An editor of `model` (passed as the atom, or as the value the run read), under a `show` switch; `drafts` has each run's Draft.
const editor = async (via: 'atom' | 'value' = 'atom') => {
  const model = Atom.make<Profile>({ name: 'Ada', age: 36 })
  const spec = Atom.make(ProfileDraft)
  const show = Atom.make(true)
  const drafts: Array<ProfileDraftAtoms> = []
  const Editor = function* () {
    const s = yield* useAtomValue(spec)
    const draft = yield* useDraft(s, via === 'atom' ? model : yield* useAtomValue(model))
    drafts.push(draft)
    return jsx('p', { children: (yield* useAtomValue(draft.value)).name })
  }
  const App = function* () {
    return (yield* useAtomValue(show)) ? jsx(Editor, {}) : jsx('p', { children: 'gone' })
  }
  const m = await go(jsx(App, {}))
  return { ...m, model, spec, show, drafts, draft: drafts[0]! }
}

describe('useDraft', () => {
  it('R3: seeds from create(src); edits change only the Draft; dirty by the schema equivalence; back to the seed is clean', async () => {
    const { store, container, model, draft } = await editor()
    expect(store.get(draft.value)).toEqual({ name: 'Ada', age: '36' })
    expect(store.get(draft.dirty)).toBe(false)
    await act(() => store.set(draft.field('name'), 'Grace'))
    expect(container.textContent).toBe('Grace')
    expect(store.get(model)).toEqual({ name: 'Ada', age: 36 })
    expect(store.get(draft.dirty)).toBe(true)
    store.set(draft.value, { name: 'Ada', age: '36' })
    expect(store.get(draft.dirty)).toBe(false)
    expect(store.get(draft.value)).toEqual({ name: 'Ada', age: '36' })
  })

  it.each(['atom', 'value'] as const)(
    'R4 (%s source): pristine re-seeds, edits are kept, reset re-seeds from the current source',
    async (via) => {
      const { store, container, model, draft } = await editor(via)
      await act(() => store.set(model, { name: 'Bob', age: 40 }))
      await flush()
      expect(container.textContent).toBe('Bob')
      expect(store.get(draft.dirty)).toBe(false)

      await act(() => store.set(draft.field('age'), '41'))
      await act(() => store.set(model, { name: 'Cy', age: 50 }))
      await flush()
      expect(store.get(draft.value)).toEqual({ name: 'Bob', age: '41' })
      expect(store.get(draft.dirty)).toBe(true)

      await act(() => draft.reset())
      await flush()
      expect(store.get(draft.value)).toEqual({ name: 'Cy', age: '50' })
      expect(store.get(draft.dirty)).toBe(false)
      expect(container.textContent).toBe('Cy')
    },
  )

  it('R2: errors by field path and valid; toDto decodes, then runs spec.toDto with its services or fails', async () => {
    const { store, draft } = await editor()
    const run = (e: ReturnType<ProfileDraftAtoms['toDto']>) =>
      Effect.runPromise(
        Effect.either(e.pipe(Effect.provideService(Clock, { now: 7 }), Effect.provideService(Store, store))),
      )
    expect(store.get(draft.errors)).toEqual({})
    expect(store.get(draft.valid)).toBe(true)

    store.set(draft.value, { name: ' ', age: 'x' })
    expect(store.get(draft.errors)).toEqual({ name: ['Enter a name'], age: ['Enter a number'] })
    expect(store.get(draft.valid)).toBe(false)
    expect(Either.getLeft(await run(draft.toDto()))).toEqual(Option.some(expect.any(ParseResult.ParseError)))

    store.set(draft.value, { name: ' Grace ', age: '7' })
    expect(await run(draft.toDto())).toEqual(Either.right({ name: 'Grace', age: 7, at: 7 }))
    store.set(draft.field('name'), 'reject')
    expect(await run(draft.toDto())).toEqual(Either.left(new Rejected()))
  })

  it('R5: preview and changes follow the Draft; errors, preview and changes compute nothing until read', async () => {
    const { store, draft } = await editor()
    count.decodes = count.previews = count.diffs = 0
    store.set(draft.field('name'), 'G')
    store.set(draft.field('name'), 'Gr')
    expect(count).toEqual({ decodes: 0, previews: 0, diffs: 0 })
    expect(store.get(draft.preview)).toEqual({ name: 'Gr', age: 36 })
    expect(store.get(draft.changes)).toEqual({ name: 'Gr' })
    expect(store.get(draft.errors)).toEqual({})
    expect(count).toEqual({ decodes: 1, previews: 1, diffs: 1 })
  })

  it('R8: a re-run reuses the Draft and its field atoms; another spec re-seeds; unmount releases its atoms', async () => {
    const { store, container, spec, show, drafts, draft, model } = await editor()
    const name = draft.field('name')
    await act(() => store.set(name, 'Grace'))
    await act(() => store.set(spec, Upper))
    await flush()
    expect(drafts.at(-1)).toBe(draft)
    expect(draft.field('name')).toBe(name)
    expect(container.textContent).toBe('ADA')

    await act(() => store.set(show, false))
    await flush()
    const live = store.inspect().map((e) => e.atom)
    expect(container.textContent).toBe('gone')
    expect(live).not.toContain(draft.value)
    expect(live).not.toContain(model)
  })

  it('R7: outside a component it returns a Draft without a slot', () => {
    const store = makeAtomStore()
    const draft = Effect.runSync(Effect.provideService(useDraft(ProfileDraft, { name: 'Ada', age: 36 }), Store, store))
    expect(store.get(draft.value)).toEqual({ name: 'Ada', age: '36' })
  })
})

describe('useDraft composition', () => {
  it("R9: a Form Action handler yields draft.toDto() into useAction's Result; useFormStatus reads its pending state", async () => {
    const model = Atom.make<Profile>({ name: 'Ada', age: 36 })
    const gate = Effect.runSync(Deferred.make<void>())
    const seen: Array<Result.Result<ProfileBody, ParseResult.ParseError | Rejected>> = []
    let draft!: ProfileDraftAtoms
    const Form = function* () {
      draft = yield* useDraft(ProfileDraft, model)
      const [result, action] = yield* useAction(function* () {
        const body = yield* draft.toDto()
        yield* Deferred.await(gate)
        return body
      })
      const { pending } = yield* useFormStatus(result)
      const r = yield* useAtomValue(result)
      seen.push(r)
      return jsx('form', { action, children: jsx('output', { children: `${r._tag}:${pending}` }) })
    }
    const { store, container, submit } = await go(jsx(Form, {}))
    const out = () => container.querySelector('output')!.textContent
    const failure = () => {
      const r = seen.at(-1)!
      return Result.isFailure(r) ? Option.getOrThrow(Cause.failureOption(r.cause)) : undefined
    }

    store.set(draft.field('age'), 'x')
    await submit()
    await flush()
    expect(out()).toBe('Failure:false')
    expect(failure()).toBeInstanceOf(ParseResult.ParseError)

    store.set(draft.field('age'), '37')
    store.set(draft.field('name'), 'reject')
    await submit()
    await flush()
    expect(failure()).toEqual(new Rejected())

    store.set(draft.field('name'), 'Grace')
    await submit()
    await flush()
    expect(out()).toBe('Failure:true')
    await act(() => Effect.runPromise(Deferred.succeed(gate, undefined)))
    await flush()
    expect(seen.at(-1)).toMatchObject({ _tag: 'Success', value: { name: 'Grace', age: 37, at: 7 } })
  })

  it('R9: spec.toModel is the apply of useOptimistic over the Model atom', async () => {
    const model = Atom.make<Profile>({ name: 'Ada', age: 36 })
    const gate = Effect.runSync(Deferred.make<void>())
    let draft!: ProfileDraftAtoms
    const Form = function* () {
      draft = yield* useDraft(ProfileDraft, model)
      const form = yield* useAtomValue(draft.value)
      const [view, optimistic] = yield* useOptimistic(model, (m: Profile, d: ProfileForm) => ProfileDraft.toModel(d, m))
      const [, action] = yield* useAction(() => optimistic(form, Effect.zipRight(draft.toDto(), Deferred.await(gate))))
      const shown = yield* useAtomValue(view)
      return jsx('form', { action, children: `${shown.name}/${shown.age}` })
    }
    const { store, container, submit } = await go(jsx(Form, {}))
    await act(() => store.set(draft.value, { name: 'Grace', age: '40' }))
    await submit()
    await flush()
    expect(container.textContent).toBe('Grace/40')
    await act(() => Effect.runPromise(Deferred.succeed(gate, undefined)))
    await flush()
    expect(container.textContent).toBe('Ada/36')
  })
})
