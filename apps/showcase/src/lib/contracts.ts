/**
 * apps/showcase/src/lib/contracts.ts
 *
 * The two directions of the data-layer model pattern (see README, "Models").
 * Read and write shapes are not inverses: `DTO(read) -fromDto-> Model -create-> Draft -toDto-> DTO(write)`.
 */
import { Data, Effect } from 'effect'
import type { z } from 'zod'

/**
 * Read side: `fromDto` is an Effect that resolves its own context from the environment `R` (services such as a
 * repo-backed lookup), so a Model asks for what it needs instead of taking a `Ctx` argument. Provide `R` once per
 * load (a Layer built once) so N DTOs share one lookup.
 */
export type ModelSpec<Dto, M, R = never> = { fromDto(dto: Dto): Effect.Effect<M, never, R> }

/**
 * Write side: one Draft is one save boundary (one action input).
 * - `schema` / `create` / `toModel` / `diff` are pure: they run on every render or keystroke.
 * - `toDto` is an Effect, the one member that may read ambients (a Clock or IdGen service) through `R`.
 * - `Src` carries both the seed and the context: the Model (edit), `void` (blank create), or a narrow ctx type.
 * - `P` is the read shape `toModel` returns for a live preview.
 */
export interface DraftSpec<D, Dto, Src = void, P = never, R = never> {
  schema(src: Src): z.ZodType<D>
  create(src: Src): D
  toDto(draft: D, src: Src): Effect.Effect<Dto, never, R>
  toModel?(draft: D, src: Src): P
  diff?(base: D, next: D): Partial<Dto>
}

/** A Draft that fails its own schema, with the designed messages. */
export class DraftInvalid extends Data.TaggedError('DraftInvalid')<{ readonly messages: readonly string[] }> {
  override get message() {
    return this.messages.join('; ')
  }
}

/** Resolves a Draft to its wire body: validate against the schema, then run `toDto`. Fails with `DraftInvalid`. */
export const resolveDraft = <D, Dto, Src, P, R>(spec: DraftSpec<D, Dto, Src, P, R>, draft: D, src: Src): Effect.Effect<Dto, DraftInvalid, R> =>
  Effect.suspend(() => {
    const parsed = spec.schema(src).safeParse(draft)
    return parsed.success
      ? spec.toDto(parsed.data, src)
      : Effect.fail(new DraftInvalid({ messages: parsed.error.issues.map((i) => i.message) }))
  })
