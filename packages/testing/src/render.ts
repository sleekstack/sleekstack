import { hydrateMount, mount, type Mounted, type Node, type Store } from '@sleekstack/ui'
import type { Cause, Effect, Layer } from 'effect'
import { act } from 'react'

type MountOptions = Parameters<typeof mount>[1]

export interface RenderOptions<A, LE> {
  readonly layer: Layer.Layer<Exclude<A, Store>, LE, never>
  /** Server HTML (from `renderToString`) to hydrate instead of mounting fresh. */
  readonly hydrate?: string
  readonly store?: MountOptions['store']
  readonly onError?: (cause: Cause.Cause<unknown>) => void
}

export interface Rendered {
  /** A `div` attached to `document.body`, removed on dispose. */
  readonly container: HTMLElement
  dispose(): Promise<void>
}

type ActGlobal = { IS_REACT_ACT_ENVIRONMENT?: boolean }
const actGlobal = globalThis as ActGlobal

const live = new Set<Rendered>()
let savedActFlag: { value: boolean | undefined } | undefined

const restoreActFlag = () => {
  if (!savedActFlag || live.size > 0) return
  if (savedActFlag.value === undefined) delete actGlobal.IS_REACT_ACT_ENVIRONMENT
  else actGlobal.IS_REACT_ACT_ENVIRONMENT = savedActFlag.value
  savedActFlag = undefined
}

// Disposes every live render; registered once per module instance on the runner's global `afterEach`, when there is one.
const cleanup = async (): Promise<void> => {
  for (const r of [...live]) await r.dispose()
}

const runnerAfterEach = (globalThis as { afterEach?: (fn: () => Promise<void>) => void }).afterEach
if (typeof runnerAfterEach === 'function') runnerAfterEach(cleanup)

/**
 * Mounts (or, with `hydrate`, hydrates) `app` into a fresh container inside `act`, with React's act environment on
 * until the last render is disposed.
 */
export const render = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  options: RenderOptions<A, LE>,
): Promise<Rendered> => {
  if (!savedActFlag) savedActFlag = { value: actGlobal.IS_REACT_ACT_ENVIRONMENT }
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.body.appendChild(document.createElement('div'))
  if (options.hydrate !== undefined) container.innerHTML = options.hydrate
  const opts = { layer: options.layer, container, store: options.store, onError: options.onError } as MountOptions
  let mounted!: Mounted
  try {
    await act(async () => void (mounted = await (options.hydrate === undefined ? mount : hydrateMount)(app, opts)))
  } catch (error) {
    container.remove()
    restoreActFlag()
    throw error
  }
  let disposed = false
  const rendered: Rendered = {
    container,
    dispose: async () => {
      if (disposed) return
      disposed = true
      await act(() => mounted.dispose())
      container.remove()
      live.delete(rendered)
      restoreActFlag()
    },
  }
  live.add(rendered)
  return rendered
}
