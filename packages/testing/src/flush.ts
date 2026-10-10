import { idle } from '@sleekstack/ui/internal'
import { Data } from 'effect'
import { act } from 'react'

export class FlushTimeout extends Data.TaggedError('FlushTimeout')<{ readonly rounds: number }> {}

export interface FlushOptions {
  /** Ticks to try before rejecting with `FlushTimeout`. Default 100. */
  readonly maxRounds?: number
  /** Milliseconds each tick waits (a macrotask) inside `act`. Default 10. */
  readonly tickMs?: number
}

/**
 * Ticks inside `act` until the ui renderer has no work in flight: pending re-runs, post-commit effects, `Pending`
 * content and handler fibers, timers they sleep on included. Rejects with `FlushTimeout` after `maxRounds` ticks
 * (about one second by default) while work is still running, such as an effect that never ends.
 *
 * Work outside the renderer (a raw `setTimeout`, a promise nothing forks) is not tracked; use Testing Library's
 * `findBy*` / `waitFor` for it.
 */
export const flush = async ({ maxRounds = 100, tickMs = 10 }: FlushOptions = {}): Promise<void> => {
  for (let round = 0; round < maxRounds; round++) {
    await act(async () => void (await new Promise((r) => setTimeout(r, round === 0 ? 0 : tickMs))))
    if (idle()) return
  }
  throw new FlushTimeout({ rounds: maxRounds })
}
