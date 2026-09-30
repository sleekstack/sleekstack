/**
 * apps/showcase/src/models/contracts.ts
 *
 * The two directions of the data-layer model pattern (see README, "Models").
 * Read and write shapes are not inverses: `DTO(read) -fromDto-> Model -create-> Draft -toDto-> DTO(write)`.
 */
import { Data, Effect } from 'effect'
import type { z } from 'zod'

/** Read side: a pure `fromDto`. `Ctx` is resolved data only (never a client, store or callable). */
export type ModelSpec<Dto, M, Ctx = void> = { fromDto(dto: Dto, ctx: Ctx): M }

/**
 * Write side: one Draft is one save boundary (one action input).
 * - `schema` / `create` / `toModel` / `diff` are pure; only `toDto` may read ambients (clock, uuid).
 * - `Src` carries both the seed and the context: the Model (edit), `void` (blank create), or a narrow ctx type.
 * - `P` is the read shape `toModel` returns for a live preview.
 */
export interface DraftSpec<D, Dto, Src = void, P = never> {
  schema(src: Src): z.ZodType<D>
  create(src: Src): D
  toDto(draft: D, src: Src): Dto
  toModel?(draft: D, src: Src): P
  diff?(base: D, next: D): Partial<Dto>
}

/** A Draft that fails its own schema, with the designed messages. */
export class DraftInvalid extends Data.TaggedError('DraftInvalid')<{ readonly messages: readonly string[] }> {
  override get message() {
    return this.messages.join('; ')
  }
}

/** Resolves a Draft to its wire body: validate against the schema, then `toDto`. Fails with `DraftInvalid`. */
export const resolveDraft = <D, Dto, Src, P>(spec: DraftSpec<D, Dto, Src, P>, draft: D, src: Src): Effect.Effect<Dto, DraftInvalid> =>
  Effect.suspend(() => {
    const parsed = spec.schema(src).safeParse(draft)
    return parsed.success
      ? Effect.sync(() => spec.toDto(parsed.data, src))
      : Effect.fail(new DraftInvalid({ messages: parsed.error.issues.map((i) => i.message) }))
  })

type Settled<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

/** The one submit path a component uses: resolve the Draft, hand the body to `send`, settle to `{ ok, data | error }`. */
export const submitDraft = <D, Dto, Src, P, T>(
  spec: DraftSpec<D, Dto, Src, P>,
  draft: D,
  src: Src,
  send: (dto: Dto) => Promise<Settled<T>>,
): Promise<Settled<T>> =>
  Effect.runPromise(
    resolveDraft(spec, draft, src).pipe(
      Effect.flatMap((dto) => Effect.promise(() => send(dto))),
      Effect.catchTag('DraftInvalid', (e) => Effect.succeed<Settled<T>>({ ok: false, error: e.message })),
    ),
  )
