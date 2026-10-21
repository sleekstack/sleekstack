import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'
import type { Plain, Point } from './types'

type Loose = { readonly v: any }
type Tree = { readonly children: readonly Tree[] }
export class Oops extends Data.TaggedError('Oops') {}

export class Bad extends ServerService('Bad')<
  Bad,
  {
    readonly date: (input: { readonly when: Date }) => Effect.Effect<void>
    readonly map: () => Effect.Effect<Map<string, number>>
    readonly set: (input: { readonly ids: Set<string> }) => Effect.Effect<void>
    readonly instance: (input: Point) => Effect.Effect<void>
    readonly fn: (input: { readonly cb: () => void }) => Effect.Effect<void>
    readonly big: (input: bigint) => Effect.Effect<void>
    readonly sym: () => Effect.Effect<{ readonly s: symbol }>
    readonly unknown: (input: unknown) => Effect.Effect<void>
    readonly any: (input: Loose) => Effect.Effect<void>
    readonly recursive: (input: Tree) => Effect.Effect<void>
    readonly plainError: () => Effect.Effect<void, Plain>
    readonly taggedSuccess: () => Effect.Effect<Oops>
    readonly holes: (input: ReadonlyArray<string | undefined>) => Effect.Effect<void>
    readonly brand: (input: string & { readonly brand: 'Id' }) => Effect.Effect<void>
  }
>() {}
