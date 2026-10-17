import { Atom, type AtomStore } from '@sleekstack/core'
import { SlotMismatch } from '@sleekstack/ui'
import { Collector, Frame, missingStore, Store, takeSlot, writeOwn } from '@sleekstack/ui/internal'
import { Context, Effect, Either, Equal, type Equivalence, Option, ParseResult, Schema } from 'effect'
import { structuralRegion } from 'effect/Utils'
import type { DraftSpec } from './model'

/**
 * An editable copy of a Model, made by `useDraft` from a `DraftSpec`: atoms in the component's Store. `preview` is in the
 * type only when the spec has `toModel`, `changes` only when it has `diff` (`Diff`); at runtime both follow the current
 * spec, reading `undefined` while it lacks the method.
 */
export type Draft<D, Dto, P = never, E = never, R = never, Diff extends boolean = false> = {
  /** The whole Draft; writing it changes only the Draft. */
  readonly value: Atom.Writable<D>
  /**
   * One field of a plain record Draft (an index of an array Draft): the same atom for a name on every call. A class
   * instance (a `Date`, a `Map`) has none: write it whole through `value`. `field` throws a `TypeError` on one.
   */
  readonly field: <K extends FieldKey<D>>(name: K) => Atom.Writable<D[K & keyof D]>
  /** Validation messages of `spec.schema(src)` by field path (`'email'`, `'items.0.name'`; `''` for the whole Draft). */
  readonly errors: Atom.Atom<{ readonly [path: string]: ReadonlyArray<string> }>
  /** No validation errors. */
  readonly valid: Atom.Atom<boolean>
  /** The Draft differs from its seed by the schema's equivalence. */
  readonly dirty: Atom.Atom<boolean>
  /** Re-seeds from the current source: `dirty` is false after. */
  readonly reset: () => void
  /** Decodes the Draft with the schema, then runs `spec.toDto(decoded, src)`. */
  readonly toDto: () => Effect.Effect<Dto, ParseResult.ParseError | E, R | Store>
} & ([P] extends [never] ? unknown : { readonly preview: Atom.Atom<P> }) &
  (Diff extends true ? { readonly changes: Atom.Atom<Partial<Dto>> } : unknown)

/**
 * What `field` takes: an array Draft's indexes, a plain record Draft's keys. Nothing for a primitive or a class instance
 * (write `value`): the types tell an instance by its methods or private members, the runtime by its prototype.
 */
type FieldKey<D> =
  D extends ReadonlyArray<unknown>
    ? number
    : D extends object
      ? [{ [K in keyof D]-?: D[K] extends Function ? K : never }[keyof D]] extends [never]
        ? { [K in keyof D]: D[K] } extends D
          ? keyof D
          : never
        : never
      : never
type AnyDraftSpec = DraftSpec<any, any, any, any, any, any>
type SpecDraft<S> = S extends { schema(...args: any): Schema.Schema<infer D, any, any> } ? D : never
type SpecSrc<S> = S extends { create(...args: infer A): any } ? (A extends [] ? void : A[0]) : never
// Not distributive: a union of specs has `preview` / `changes` only when every member has `toModel` / `diff`.
type SpecPreview<S> = [S] extends [{ toModel(...args: any): infer P }] ? P : never
type SpecDto<S> = S extends { toDto(...args: any): Effect.Effect<infer Dto, any, any> } ? Dto : never
type SpecError<S> = S extends { toDto(...args: any): Effect.Effect<any, infer E, any> } ? E : never
type SpecContext<S> = S extends { toDto(...args: any): Effect.Effect<any, any, infer R> } ? R : never
type DraftOf<S> = Draft<
  SpecDraft<S>,
  SpecDto<S>,
  SpecPreview<S>,
  SpecError<S>,
  SpecContext<S>,
  [S] extends [{ diff(...args: any): any }] ? true : false
>

/** What a Draft was seeded from; the schema and its equivalence are computed once per basis, on first use. */
interface DraftBasis {
  readonly spec: AnyDraftSpec
  readonly src: unknown
  readonly seed: unknown
  schema?: Schema.Schema<any>
  equals?: Equivalence.Equivalence<any>
}
interface DraftState {
  readonly basis: DraftBasis
  readonly draft: unknown
}
interface DraftBox {
  readonly input: Atom.Writable<{ readonly spec: AnyDraftSpec; readonly src: unknown }>
  readonly state: Atom.Writable<DraftState>
  readonly draft: object
}

// The same source or spec: the same atom or object, or an equal value (plain objects and arrays by structure, functions by
// identity, `Equal` values by `Equal`), so a literal or `{ ...Spec }` rebuilt by every run is no change. A class instance
// is compared by identity: its settings may live where they cannot be compared.
const same = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) || (!Atom.isAtom(a) && !Atom.isAtom(b) && structuralRegion(() => Equal.equals(a, b)))
const schemaOf = (b: DraftBasis) => (b.schema ??= b.spec.schema(b.src))
const pristine = (b: DraftBasis, draft: unknown) => (b.equals ??= Schema.equivalence(schemaOf(b)))(b.seed, draft)
const seeded = (spec: AnyDraftSpec, src: unknown): DraftState => {
  const seed = spec.create(src)
  return { basis: { spec, src, seed }, draft: seed }
}
const NO_ERRORS: { readonly [path: string]: ReadonlyArray<string> } = {}
// A field write copies the Draft, and only a plain record or an array copies whole: a class instance (a `Date`, a `Map`)
// holds state a copy cannot reach (private fields, internal slots), so it is written whole through `value`.
const copyable = (d: unknown): Record<PropertyKey, unknown> => {
  const proto = typeof d === 'object' && d !== null ? Object.getPrototypeOf(d) : undefined
  if (proto === null || proto === Object.prototype || proto === Array.prototype)
    return d as Record<PropertyKey, unknown>
  throw new TypeError('Draft.field() needs a plain record or array Draft: write a class instance through `value`')
}

const makeDraft = (spec: AnyDraftSpec, src: unknown, s: AtomStore): DraftBox => {
  const input = Atom.make<{ readonly spec: AnyDraftSpec; readonly src: unknown }>({ spec, src })
  // Follows the source (an atom, or the value the newest run passed): a pristine Draft re-seeds, an edited one keeps its edits.
  const state = Atom.writable<DraftState>(
    (get) => {
      const i = get(input)
      const now = Atom.isAtom(i.src) ? get(i.src) : i.src
      const prev = get.self<DraftState>()
      if (prev && same(prev.basis.spec, i.spec)) {
        if (same(prev.basis.src, now)) return prev
        if (!pristine(prev.basis, prev.draft))
          return { basis: { spec: i.spec, src: now, seed: prev.basis.seed }, draft: prev.draft }
      }
      return seeded(i.spec, now)
    },
    (cx, next) => cx.setSelf(next),
  )
  const value = Atom.writable<unknown>(
    (get) => get(state).draft,
    (cx, draft) => {
      const { basis, draft: current } = cx.get(state)
      if (!Object.is(current, draft)) cx.set(state, { basis, draft })
    },
  )
  const fields = new Map<PropertyKey, Atom.Writable<unknown>>()
  const field = (name: PropertyKey): Atom.Writable<unknown> => {
    copyable(s.get(value))
    let atom = fields.get(name)
    if (!atom)
      fields.set(
        name,
        (atom = Atom.writable<unknown>(
          (get) => (get(value) as Record<PropertyKey, unknown>)[name],
          (cx, v) => {
            const d = copyable(cx.get(value))
            if (Object.is(d[name], v)) return
            // A copy of the same kind: an array stays an array, a record keeps its prototype (`null` or `Object`).
            const next = Array.isArray(d) ? [...d] : Object.assign(Object.create(Object.getPrototypeOf(d)), d)
            Object.defineProperty(next, name, { value: v, writable: true, enumerable: true, configurable: true })
            cx.set(value, next)
          },
        )),
      )
    return atom
  }
  const errors = Atom.make((get) => {
    const { basis, draft } = get(state)
    const decoded = Schema.decodeEither(schemaOf(basis), { errors: 'all' })(draft)
    if (Either.isRight(decoded)) return NO_ERRORS
    const out: Record<string, Array<string>> = {}
    for (const issue of ParseResult.ArrayFormatter.formatErrorSync(decoded.left))
      (out[issue.path.map(String).join('.')] ??= []).push(issue.message)
    return out
  })
  const draft = {
    value,
    field,
    errors,
    valid: Atom.make((get) => Object.keys(get(errors)).length === 0),
    dirty: Atom.make((get) => {
      const { basis, draft } = get(state)
      return !pristine(basis, draft)
    }),
    reset: () => {
      const { basis } = s.get(state)
      s.set(state, seeded(basis.spec, basis.src))
    },
    toDto: () =>
      Effect.flatMap(Effect.serviceOption(Store), (so) => {
        if (Option.isNone(so)) return missingStore('Draft.toDto')
        const { basis, draft } = so.value.get(state)
        return Effect.flatMap(Schema.decode(schemaOf(basis), { errors: 'all' })(draft), (decoded) =>
          basis.spec.toDto(decoded, basis.src),
        )
      }),
    preview: Atom.make((get) => {
      const { basis, draft } = get(state)
      return basis.spec.toModel?.(draft, basis.src)
    }),
    changes: Atom.make((get) => {
      const { basis, draft } = get(state)
      return basis.spec.diff?.(basis.seed, draft)
    }),
  }
  return { input, state, draft }
}

/**
 * `useDraft(spec, src)`: a Draft of the Model `src` (a value, or an atom of it) as `spec` describes it (`DraftSpec`). It starts as `spec.create(src)`; edits through `value` or `field(name)` change only the Draft.
 * `field(name)` is for a plain record or an array Draft: a class instance (a `Date`, a `Map`) is written whole through
 * `value`, and `field` throws a `TypeError` on one, as a field write's copy would lose its private state. When the
 * source changes (the atom, or a different `src` on a later run) while the Draft is pristine, it re-seeds from it; after
 * an edit the edits are kept. A value `src` and the `spec` are compared by structure (plain objects and arrays,
 * functions by identity) or `Equal`, so a literal or `{ ...Spec }` rebuilt by every run is no change; a class instance
 * that is not `Equal` is compared by identity. `reset()` re-seeds from the current source. `errors`, `valid`, `dirty`, `preview`
 * and `changes` are atoms computed only when read. `toDto()` validates with the schema and runs `spec.toDto`: yield it
 * in a Form Action handler and its `ParseError` or service failure lands in `useAction`'s `Result`.
 *
 * The same Draft, with the same `field(name)` atoms, on every run; its atoms are released with the instance, and another
 * `spec` on a later run re-seeds it. Takes a slot like `useLocal`, so call it unconditionally. Outside a component it
 * returns a new Draft without a slot, whose atoms live while something reads them.
 */
export const useDraft = <S extends AnyDraftSpec>(
  spec: S & DraftSpec<SpecDraft<S>, SpecDto<S>, SpecSrc<S>, unknown, SpecError<S>, SpecContext<S>>,
  src: SpecSrc<S> | Atom.Atom<SpecSrc<S>>,
): Effect.Effect<DraftOf<S>, never, Store> =>
  Effect.flatMap(Effect.context<never>(), (ctx) => {
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useDraft') as Effect.Effect<never>
    const s = so.value
    const f = Context.get(ctx, Frame)
    if (Context.get(ctx, Collector) === undefined || f === undefined)
      return Effect.succeed(makeDraft(spec, src, s).draft as DraftOf<S>)
    const taken = takeSlot(f)
    if (taken instanceof SlotMismatch) return Effect.fail(taken) as unknown as Effect.Effect<never>
    if (taken.first) {
      const box = makeDraft(spec, src, s)
      // The slot atom only holds the box, as `useRef`'s does; the Draft's own state is retained for the slot's life.
      f.owner.atoms.push(Atom.make(box) as unknown as Atom.Writable<any>)
      f.owner.releases.push(s.retain(box.input), s.retain(box.state))
    }
    const box = s.get(f.owner.atoms[taken.i] as unknown as Atom.Atom<DraftBox>)
    const last = s.get(box.input)
    if (!same(last.spec, spec) || !same(last.src, src)) {
      writeOwn(f.owner, () => s.set(box.input, { spec, src }))
    }
    return Effect.succeed(box.draft as DraftOf<S>)
  })
