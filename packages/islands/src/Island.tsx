import { createElement, lazy, Suspense, useEffect, useRef, type ComponentProps, type ComponentType } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { arm, type Trigger } from './triggers'

export type IslandLoader = () => Promise<{ default: ComponentType<any> }>

export type IslandProps<M extends Record<string, IslandLoader>, N extends keyof M> = {
  readonly name: N
  readonly props: ComponentProps<Awaited<ReturnType<M[N]>>['default']>
  readonly hydrate?: Trigger
}

export class IslandNotFound extends Error {
  override readonly name = 'IslandNotFound'
}

// One activation per container: guards StrictMode double effects and same-node remounts.
// The stored promise is the activation token: a load that resolves after its
// activation was dropped (unmounted, or replaced by a remount) creates no root.
const activations = new WeakMap<Element, Promise<Root | undefined>>()
const pendingUnmount = new WeakMap<Element, ReturnType<typeof setTimeout>>()

const EMPTY = { __html: '' }

export const defineIslands = <M extends Record<string, IslandLoader>>(map: M) => {
  const lazies = new Map<string, ComponentType<unknown>>()
  const serverComponent = (name: string) => {
    let c = lazies.get(name)
    if (!c) lazies.set(name, (c = lazy(map[name]!) as ComponentType<unknown>))
    return c
  }

  return function Island<N extends keyof M & string>({ name, props, hydrate = 'visible' }: IslandProps<M, N>) {
    if (!Object.hasOwn(map, name)) throw new IslandNotFound(`Unknown island "${name}"`)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const el = ref.current!
      const t = pendingUnmount.get(el)
      if (t !== undefined) {
        clearTimeout(t)
        pendingUnmount.delete(el)
      }
      const disarm = arm(el, hydrate, () => {
        if (activations.has(el)) return
        const activation: Promise<Root | undefined> = map[name]!().then(
          ({ default: C }) => {
            if (activations.get(el) !== activation) return undefined
            const tree = createElement(Suspense, null, createElement(C, props))
            // Server HTML present: attach to it. Fresh client mount (no server HTML): render.
            if (el.firstChild)
              return hydrateRoot(el, tree, { onRecoverableError: (e) => console.error(`[island ${name}]`, e) })
            const root = createRoot(el)
            root.render(tree)
            return root
          },
          (e) => {
            console.error(`[island ${name}] chunk failed to load`, e)
            return undefined
          },
        )
        activations.set(el, activation)
      })
      return () => {
        disarm()
        // Deferred: unmounting another root synchronously during a commit warns;
        // a same-node remount before the tick cancels it and keeps the activation.
        pendingUnmount.set(
          el,
          setTimeout(() => {
            pendingUnmount.delete(el)
            const activation = activations.get(el)
            activations.delete(el)
            void activation?.then((root) => root?.unmount())
          }),
        )
      }
      // Props are read once at activation; the container never changes after first render.
    }, [])

    if (typeof window === 'undefined') {
      return (
        <div data-island={name} ref={ref}>
          <Suspense>{createElement(serverComponent(name), props)}</Suspense>
        </div>
      )
    }
    // Client: empty innerHTML + suppressHydrationWarning keeps the server DOM untouched,
    // and the constant props mean a wrapper re-render never rewrites it.
    return <div data-island={name} ref={ref} dangerouslySetInnerHTML={EMPTY} suppressHydrationWarning />
  }
}
