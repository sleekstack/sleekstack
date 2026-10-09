import { Data } from 'effect'
import { act } from 'react'

export class FlushTimeout extends Data.TaggedError('FlushTimeout')<{ readonly rounds: number }> {}

const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

/**
 * Ticks inside `act` until a tick leaves `document.body` unchanged, so pending re-runs and post-commit effects have run.
 * Rejects with `FlushTimeout` after `maxRounds` ticks that all changed the DOM.
 */
export const flush = async (maxRounds = 50): Promise<void> => {
  let mutated = false
  const observer = new MutationObserver(() => void (mutated = true))
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  try {
    for (let round = 0; round < maxRounds; round++) {
      mutated = false
      await tick()
      if (!mutated && observer.takeRecords().length === 0) return
    }
  } finally {
    observer.disconnect()
  }
  throw new FlushTimeout({ rounds: maxRounds })
}
