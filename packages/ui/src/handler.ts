import type { Atom } from '@sleekstack/core'
import { Data, type Effect } from 'effect'
import type { Node } from './node'

/** Serializable snapshot of a DOM event, taken at dispatch. `value`/`checked` only from form controls. */
export interface HandlerEvent {
  readonly type: string
  readonly value?: string
  readonly checked?: boolean
  readonly key?: string
}
/** Static flags the server emits so the delegated listener applies them before the handler loads. */
export interface HandlerOptions {
  readonly preventDefault?: boolean
  readonly stopPropagation?: boolean
}
/** A named Effect program run on an event; its `id` is the only thing the server emits. */
export interface Handler<E = never, R = never> {
  readonly id: string
  readonly run: (event: HandlerEvent) => Effect.Effect<void, E, R>
  readonly opts: HandlerOptions
}

export class DuplicateHandler extends Data.TaggedError('DuplicateHandler')<{ readonly id: string }> {}
export class DuplicateBindKey extends Data.TaggedError('DuplicateBindKey')<{ readonly key: string }> {}
/** `bind`/`resume` got an atom that is not a serializable value-kind atom (`Atom.serializable`). */
export class UnsupportedAtom extends Data.TaggedError('UnsupportedAtom')<{ readonly key: string }> {}
export class UnsupportedEvent extends Data.TaggedError('UnsupportedEvent')<{ readonly event: string }> {}

/** Declares a handler. Call at module top level with a literal `id`. */
export const defineHandler = <E = never, R = never>(
  id: string,
  run: (event: HandlerEvent) => Effect.Effect<void, E, R>,
  opts: HandlerOptions = {},
): Handler<E, R> => ({ id, run, opts })

/** True for a value built by `defineHandler`. */
export const isHandler = (v: unknown): v is Handler<any, any> =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Handler).id === 'string' &&
  typeof (v as Handler).run === 'function' &&
  typeof (v as Handler).opts === 'object'

// Events that never bubble, so a delegated container listener cannot see them. Any other lowercase event name is accepted.
const NON_BUBBLING_EVENTS = [
  'focus',
  'blur',
  'load',
  'unload',
  'error',
  'scroll',
  'scrollend',
  'mouseenter',
  'mouseleave',
  'pointerenter',
  'pointerleave',
  'invalid',
  'abort',
  'cancel',
  'close',
  'toggle',
  'beforetoggle',
  'loadstart',
  'loadeddata',
  'loadedmetadata',
  'loadend',
  'progress',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'ended',
  'pause',
  'play',
  'playing',
  'ratechange',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
  'resize',
] as const
/** An event a `defineHandler` value cannot be attached to; only a closure handles it. */
export type NonBubblingEvent = (typeof NON_BUBBLING_EVENTS)[number]
const NON_BUBBLING: ReadonlySet<string> = new Set(NON_BUBBLING_EVENTS)
/** Throws `UnsupportedEvent` for non-bubbling events and malformed names (`onclick`); returns the event. */
export const checkEvent = (event: string): string => {
  if (!/^[a-z][a-z0-9]*$/.test(event) || event.startsWith('on') || NON_BUBBLING.has(event))
    throw new UnsupportedEvent({ event })
  return event
}

/** Attaches handlers (event name to `Handler`) to an element node. */
export const on = (node: Node, events: Record<string, Handler<any, any>>): Node => {
  if (node._tag !== 'Element') throw new TypeError('on() needs an element node')
  for (const e of Object.keys(events)) checkEvent(e)
  return { ...node, on: { ...node.on, ...events } }
}

/** Throws `UnsupportedAtom` unless `atom` is a serializable value-kind atom; returns its wire info. */
export const valueInfo = (atom: Atom.Atom<any>): NonNullable<Atom.Atom<any>['serializable']> => {
  const info = atom.serializable
  if (info?.kind !== 'value') throw new UnsupportedAtom({ key: info?.key ?? '(not serializable)' })
  return info
}

/** Renders a serializable value-kind `atom`'s current value as text, bound under the atom's own serializable key for resume. */
export const bind = <A>(atom: Atom.Atom<A>): Node => {
  valueInfo(atom)
  return { _tag: 'Bind', atom }
}
