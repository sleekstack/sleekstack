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
export class UnsupportedEvent extends Data.TaggedError('UnsupportedEvent')<{ readonly event: string }> {}

/** Declares a handler. Call at module top level with a literal `id`. */
export const defineHandler = <E = never, R = never>(
  id: string,
  run: (event: HandlerEvent) => Effect.Effect<void, E, R>,
  opts: HandlerOptions = {},
): Handler<E, R> => ({ id, run, opts })

// Events that bubble to a delegated container listener; anything else (focus, blur, invalid, media, ...) is rejected.
const BUBBLING = new Set(
  'click dblclick auxclick contextmenu mousedown mouseup mousemove mouseover mouseout pointerdown pointerup pointermove pointerover pointerout pointercancel touchstart touchend touchmove touchcancel wheel keydown keyup beforeinput input change submit reset focusin focusout select drag dragstart dragend dragenter dragleave dragover drop copy cut paste compositionstart compositionupdate compositionend'.split(' '),
)
/** Throws `UnsupportedEvent` unless `event` is a supported bubbling event. */
export const checkEvent = (event: string): string => {
  if (!BUBBLING.has(event)) throw new UnsupportedEvent({ event })
  return event
}

/** Attaches handlers (event name to `Handler`) to an element node. */
export const on = (node: Node, events: Record<string, Handler<any, any>>): Node => {
  if (node._tag !== 'Element') throw new TypeError('on() needs an element node')
  for (const e of Object.keys(events)) checkEvent(e)
  return { ...node, on: { ...node.on, ...events } }
}

/** Renders `atom`'s current value as text, bound under `key` for resume. */
export const bind = <A>(atom: Atom.Atom<A>, key: string): Node => ({ _tag: 'Bind', atom, key })
