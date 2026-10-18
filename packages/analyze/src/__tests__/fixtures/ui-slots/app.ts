import { Atom } from '@sleekstack/core'
import { type DraftSpec, defineRecord, useDraft, useRecord } from '@sleekstack/model'
import { Effect, Layer, Schema } from 'effect'
import { useDraft as useOtherDraft } from './other/draft'
import { el, mount, useDeferredAtom, useDerivedAtom, useEffect, useLocal, useRef } from '@sleekstack/ui'

const count = Atom.make(0)
const Note = {
  schema: () => Schema.String,
  create: () => '',
  toDto: (d: string) => Effect.succeed(d),
} satisfies DraftSpec<string, string>
const Post = defineRecord('post', { fields: { id: Schema.String } })
const fetchNothing = { fetch: () => Effect.void }

const Good = () =>
  Effect.gen(function* () {
    const [open, setOpen] = yield* useLocal(false)
    yield* useLocal(0)
    yield* useEffect(() => {})
    yield* useRef<HTMLElement>()
    yield* useDerivedAtom((get) => get(count))
    yield* useDeferredAtom(count)
    yield* useDraft(Note, undefined)
    yield* useRecord(Post, '1', { via: fetchNothing })
    if (open) return el('p', {}, 'open')
    setOpen(true)
    return el('p')
  })

const Bad = (flag: boolean, ids: readonly number[]) =>
  Effect.gen(function* () {
    if (flag) yield* useLocal(1) // @error ConditionalSlot
    if (flag) yield* useEffect(() => {}) // @error ConditionalSlot
    if (flag) yield* useRef() // @error ConditionalSlot
    if (flag) yield* useDerivedAtom((get) => get(count)) // @error ConditionalSlot
    if (flag) yield* useDeferredAtom(count) // @error ConditionalSlot
    if (flag) yield* useDraft(Note, undefined) // @error ConditionalSlot
    if (flag) yield* useRecord(Post, '1', { via: fetchNothing }) // @error ConditionalSlot
    if (flag) yield* useOtherDraft(Note, undefined)
    for (const _ of ids) yield* useLocal(2) // @error ConditionalSlot
    const x = flag ? yield* useLocal(3) : undefined // @error ConditionalSlot
    const nested = () => Effect.gen(function* () { return yield* useLocal(4) }) // @error ConditionalSlot
    if (ids.length === 0) return el('p', {}, String(x))
    yield* useLocal(5) // @error ConditionalSlot
    yield* useEffect(() => {}) // @error ConditionalSlot
    yield* nested()
    return el('p')
  })

const useCounter = () =>
  Effect.gen(function* () {
    const [n] = yield* useLocal(0) // @error ConditionalSlot
    return n
  })

const Direct = () => Effect.map(useLocal(0), ([n]) => el('b', {}, String(n))) // @error ConditionalSlot

const App = () =>
  Effect.gen(function* () {
    yield* useCounter()
    return el('main', {}, yield* Good(), yield* Bad(true, []), yield* Direct())
  })

export const run = (c: Element) => mount(App(), { layer: Layer.empty, container: c })
