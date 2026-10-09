import { Data } from 'effect'
import { act } from 'react'

export class FlushTimeout extends Data.TaggedError('FlushTimeout')<{ readonly rounds: number }> {}

export interface FlushOptions {
  /** Ticks to try before rejecting with `FlushTimeout`. Default 50. */
  readonly maxRounds?: number
  /** Consecutive ticks that must leave the DOM unchanged. Default 3. */
  readonly quietTicks?: number
  /** Milliseconds each tick waits (a macrotask) inside `act`. Default 5. */
  readonly tickMs?: number
}

/**
 * Ticks inside `act` until `quietTicks` consecutive ticks leave `document.body` unchanged, so pending re-runs,
 * post-commit effects and short timers they schedule (up to about `quietTicks * tickMs` ms) have run. Rejects with
 * `FlushTimeout` after `maxRounds` ticks without that quiet window.
 *
 * Limit: work that waits longer than the quiet window (a long `Effect.sleep`, a slow request) is not awaited; use
 * Testing Library's `findBy*` / `waitFor` for it.
 */
export const flush = async ({ maxRounds = 50, quietTicks = 3, tickMs = 5 }: FlushOptions = {}): Promise<void> => {
  let mutated = false
  const observer = new MutationObserver(() => void (mutated = true))
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  try {
    let quiet = 0
    for (let round = 0; round < maxRounds; round++) {
      mutated = false
      await act(async () => void (await new Promise((r) => setTimeout(r, tickMs))))
      quiet = !mutated && observer.takeRecords().length === 0 ? quiet + 1 : 0
      if (quiet >= quietTicks) return
    }
  } finally {
    observer.disconnect()
  }
  throw new FlushTimeout({ rounds: maxRounds })
}
