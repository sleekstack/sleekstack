// @vitest-environment jsdom
import { Atom, makeAtomStore, Result } from '@sleekstack/core'
import { Cause, Context, Data, Deferred, Effect, Either, Layer, Option, ParseResult, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mount, type Mounted, Store, useAction, useAtomValue, useFormStatus, useOptimistic } from '@sleekstack/ui'
import { idle } from '@sleekstack/ui/internal'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { type Draft, type DraftSpec, useDraft } from '../index'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
// Ticks until the renderer is idle; a re-run loop never is, so it gives up after 50 ticks.
const settle = async () => {
  for (let i = 0; i < 50; i++) {
    await flush()
    if (idle()) return
  }
}

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

// An editor of `model` under a `show` switch. `via`: the model atom, the value the run read, or a fresh copy of that value
// and of the spec on every run. `async`: the run waits a task before it returns. `drafts` has each run's Draft; `tick`
// re-runs it for nothing.
const editor = async (via: 'atom' | 'value' | 'inline' = 'atom', async = false) => {
  const model = Atom.make<Profile>({ name: 'Ada', age: 36 })
  const spec = Atom.make(ProfileDraft)
  const show = Atom.make(true)
  const tick = Atom.make(0)
  const drafts: Array<ProfileDraftAtoms> = []
  const Editor = function* () {
    yield* useAtomValue(tick)
    const s = yield* useAtomValue(spec)
    const draft =
      via === 'inline'
        ? yield* useDraft({ ...s }, { ...(yield* useAtomValue(model)) })
        : yield* useDraft(s, via === 'atom' ? model : yield* useAtomValue(model))
    drafts.push(draft)
    if (async) yield* Effect.promise(() => new Promise((r) => setTimeout(r, 0)))
    return jsx('p', { children: (yield* useAtomValue(draft.value)).name })
  }
  const App = function* () {
    return (yield* useAtomValue(show)) ? jsx(Editor, {}) : jsx('p', { children: 'gone' })
  }
  const m = await go(jsx(App, {}))
  return { ...m, model, spec, show, tick, drafts, draft: drafts[0]! }
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

  it.each([
    ['atom', false],
    ['value', false],
    ['inline', true],
  ] as const)(
    'R4 (%s source, async %s): pristine re-seeds, edits are kept, reset re-seeds from the current source',
    async (via, async) => {
      const { store, container, model, drafts, draft } = await editor(via, async)
      // One run follows the new source: its own write to the Draft does not re-run (interrupt) it.
      await act(() => store.set(model, { name: 'Bob', age: 40 }))
      await settle()
      expect(drafts.length).toBe(2)
      expect(container.textContent).toBe('Bob')
      expect(store.get(draft.dirty)).toBe(false)

      await act(() => store.set(draft.field('age'), '41'))
      await act(() => store.set(model, { name: 'Cy', age: 50 }))
      await settle()
      expect(store.get(draft.value)).toEqual({ name: 'Bob', age: '41' })
      expect(store.get(draft.dirty)).toBe(true)

      await act(() => draft.reset())
      await settle()
      expect(store.get(draft.value)).toEqual({ name: 'Cy', age: '50' })
      expect(store.get(draft.dirty)).toBe(false)
      expect(container.textContent).toBe('Cy')
      expect(drafts.every((d) => d === draft)).toBe(true)
    },
  )

  it('R4: an equal source or spec on a re-run is no change; an async run with fresh copies commits once', async () => {
    const { store, container, tick, spec, drafts, draft } = await editor('inline', true)
    const rerun = async (n: number) => {
      const runs = drafts.length
      await act(() => store.set(tick, n))
      await settle()
      return drafts.length - runs
    }
    expect(await rerun(1)).toBe(1)
    expect(container.textContent).toBe('Ada')

    await act(() => store.set(draft.field('name'), 'Grace'))
    await settle()
    expect(await rerun(2)).toBe(1)
    expect(store.get(draft.value)).toEqual({ name: 'Grace', age: '36' })
    expect(store.get(draft.dirty)).toBe(true)

    // A spec with other members is a swap: it re-seeds, edits and all.
    await act(() => store.set(spec, Upper))
    await settle()
    expect(container.textContent).toBe('ADA')
    expect(store.get(draft.dirty)).toBe(false)
    expect(await rerun(3)).toBe(1)
  })

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

  it('R8: another instance of a spec class is a swap, though it shares its methods', async () => {
    class Capped {
      constructor(readonly max: number) {}
      schema() {
        return ProfileFormSchema
      }
      create(m: Profile): ProfileForm {
        return { name: m.name.slice(0, this.max), age: String(m.age) }
      }
      toDto(d: ProfileForm) {
        return ProfileDraft.toDto(d)
      }
    }
    const spec = Atom.make(new Capped(2))
    const Editor = function* () {
      const draft = yield* useDraft(yield* useAtomValue(spec), { name: 'Ada', age: 36 })
      return jsx('p', { children: (yield* useAtomValue(draft.value)).name })
    }
    const { store, container } = await go(jsx(Editor, {}))
    expect(container.textContent).toBe('Ad')
    await act(() => store.set(spec, new Capped(1)))
    await settle()
    expect(container.textContent).toBe('A')
  })

  it('R7: outside a component it returns a Draft without a slot', () => {
    const store = makeAtomStore()
    const draft = Effect.runSync(Effect.provideService(useDraft(ProfileDraft, { name: 'Ada', age: 36 }), Store, store))
    expect(store.get(draft.value)).toEqual({ name: 'Ada', age: '36' })
  })

  it('R8: the Draft keeps its shape across spec swaps; preview and changes follow the current spec', async () => {
    const Plain = { schema: ProfileDraft.schema, create: ProfileDraft.create, toDto: ProfileDraft.toDto }
    const spec = Atom.make<typeof ProfileDraft | typeof Plain>(Plain)
    const model = Atom.make<Profile>({ name: 'Ada', age: 36 })
    let draft!: ProfileDraftAtoms
    const Editor = function* () {
      draft = (yield* useDraft(yield* useAtomValue(spec), model)) as ProfileDraftAtoms
      return jsx('p', { children: (yield* useAtomValue(draft.value)).name })
    }
    const { store } = await go(jsx(Editor, {}))
    const first = draft
    expect([store.get(draft.preview), store.get(draft.changes)]).toEqual([undefined, undefined])
    await act(() => store.set(spec, ProfileDraft))
    await flush()
    expect(draft).toBe(first)
    expect([store.get(draft.preview), store.get(draft.changes)]).toEqual([{ name: 'Ada', age: 36 }, {}])
    await act(() => store.set(spec, Plain))
    await flush()
    expect([store.get(draft.preview), store.get(draft.changes)]).toEqual([undefined, undefined])
  })

  it('R2: field() edits a plain record or an array; a class instance throws and is written whole through value', () => {
    class Point {
      readonly #label: string
      constructor(
        readonly x: number,
        readonly y: number,
        label: string,
      ) {
        this.#label = label
      }
      describe() {
        return `${this.#label} ${Math.hypot(this.x, this.y)}`
      }
    }
    const Tags = {
      schema: () => Schema.Array(Schema.String),
      create: (tags: ReadonlyArray<string>) => tags,
      toDto: (d: ReadonlyArray<string>) => Effect.succeed(d),
    } satisfies DraftSpec<ReadonlyArray<string>, ReadonlyArray<string>, ReadonlyArray<string>>
    const At = {
      schema: () => Schema.instanceOf(Point),
      create: () => new Point(3, 0, 'p'),
      toDto: (p: Point) => Effect.succeed(p),
    } satisfies DraftSpec<Point, Point>
    const store = makeAtomStore()
    const run = <A>(e: Effect.Effect<A, never, Store>) => Effect.runSync(Effect.provideService(e, Store, store))
    const tags = run(useDraft(Tags, ['a', 'b']))
    store.set(tags.field(0), 'x')
    expect(store.get(tags.value)).toEqual(['x', 'b'])

    const at = run(useDraft(At, undefined))
    const field = at.field as (name: string) => Atom.Writable<unknown>
    expect(() => field('y')).toThrow(TypeError)
    store.set(at.value, new Point(3, 4, 'p'))
    expect(store.get(at.value).describe()).toBe('p 5')

    // A field atom taken while the Draft was a record throws on a write once it holds an instance.
    const profile = run(useDraft(ProfileDraft, { name: 'Ada', age: 36 }))
    const name = profile.field('name')
    store.set(profile.value, Object.assign(new Point(0, 0, 'p'), { name: 'Ada', age: '36' }))
    expect(() => store.set(name, 'Grace')).toThrow(TypeError)
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
