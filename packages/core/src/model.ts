import type { Effect, Schema } from 'effect'

/**
 * The read direction of a Model: a pure projection of a wire shape (and of resolved data it does not carry) into the
 * shape the view renders. Ported from the ramcinpay-front contract (`fromDto(dto, ctx)`), itself after EmberData.
 *
 * ```text
 * Wire(read) ──fromDto(dto, ctx)──▶ Model ──create──▶ Draft ──toDto (Effect)──▶ Wire(write)
 *                                     ▲                 │
 *                                     └──── toModel ────┘
 * ```
 *
 * `Ctx` is resolved data only (`{ countries: CountryIndex }`), never a Service or client; it defaults to `void`, so a
 * Model that needs nothing keeps a one-argument `fromDto`. `fromDto` is pure: no clock, locale or random reads.
 */
export type ModelSpec<Dto, M, Ctx = void> = {
  fromDto(dto: Dto, ctx: Ctx): M
}

/**
 * The write direction of a Model: how a Draft (the edited copy, one save boundary) is seeded, validated and turned into
 * the wire body. It is not the inverse of `fromDto`: the two directions meet at the Model.
 *
 * - `schema(src)`: validation of the Draft. Its Type and Encoded are both `D`: Draft fields hold what the input holds
 *   (a number input's field is a `string`); validate the string and convert it in `toDto`, never coerce in the schema.
 * - `create(src)`: the seed — the Model's values for an edit form, blanks for a create form.
 * - `toDto(draft, src)`: the wire body, as an Effect. Ambients it needs (ids, the clock) are Services in `R`, failures
 *   are `E`. It receives the draft as the schema decoded it.
 * - `toModel(draft, src)`: optional; unsaved Draft state projected into a read shape (a live preview, or the `apply` of
 *   an optimistic update). Total over a half-filled Draft.
 * - `diff(base, next)`: optional; the minimal PATCH body between two Drafts.
 *
 * `schema`, `create`, `toModel` and `diff` are pure. `src` carries both the seed and any context; `void` when there is
 * neither.
 */
export type DraftSpec<D, Dto, Src = void, P = never, E = never, R = never> = {
  schema(src: Src): Schema.Schema<D, D>
  create(src: Src): D
  toDto(draft: D, src: Src): Effect.Effect<Dto, E, R>
  toModel?(draft: D, src: Src): P
  diff?(base: D, next: D): Partial<Dto>
}
