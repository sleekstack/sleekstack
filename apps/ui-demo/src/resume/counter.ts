import { bind, el, on } from '@sleekstack/ui'
import { Effect } from 'effect'
import { countAtom } from './count'
import increment from './increment'

/** A resumable counter: server-rendered, then interactive without re-running. */
export const Counter = () =>
  Effect.succeed(el('div', { class: 'counter' }, on(el('button', {}, '+1'), { click: increment }), el('output', {}, bind(countAtom))))
