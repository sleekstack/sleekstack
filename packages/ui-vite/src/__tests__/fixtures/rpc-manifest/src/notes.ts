import { Context, Data } from 'effect'

/** Who calls: the Manifest's `wrap` reads it from the `user` cookie, the directory `wrap` gives `rest`. */
export class Viewer extends Context.Tag('Viewer')<Viewer, string>() {}

/** Client-safe: the generated client imports it. */
export class NoteLocked extends Data.TaggedError('NoteLocked')<{ readonly id: number }> {}
