import { Component, createElement, lazy, Suspense, use, useEffect, useRef, type ComponentProps, type ComponentType, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { validateProvide } from '@sleekstack/kit'
import { LayerProvider } from '@sleekstack/kit/react'
import { processAppScope, sharedAppScope } from './appScope'
import { replayClick } from './replay'
import { arm, type Trigger } from './triggers'

export type IslandLoader = () => Promise<{ default: ComponentType<any> }>

export type IslandProps<M extends Record<string, IslandLoader>, N extends keyof M> = {
  readonly name: N
  readonly props: ComponentProps<Awaited<ReturnType<M[N]>>['default']>
  readonly hydrate?: Trigger
  /** IntersectionObserver `rootMargin` for the `visible` trigger. */
  readonly rootMargin?: string
  /** Component-scope kit entries for this Island instance only. Read once, at activation. */
  readonly provide?: Provide
}

type Provide = Parameters<typeof sharedAppScope>[0]

export type DefineIslandsOptions = {
  /** App-scope kit entries, shared by every Island of this registry on the page. */
  readonly provide?: Provide
}

export class IslandNotFound extends Error {
  override readonly name = 'IslandNotFound'
}

// One activation per container: guards StrictMode double effects and same-node remounts.
// The stored promise is the activation token: a load that resolves after its
// activation was dropped (unmounted, or replaced by a remount) creates no root.
type Activation = Promise<{ readonly unmount: () => void } | undefined>
const activations = new WeakMap<Element, Activation>()
const pendingUnmount = new WeakMap<Element, ReturnType<typeof setTimeout>>()
// Present while an `interaction` activation loads: the first click to replay, or null.
const pendingClicks = new WeakMap<Element, Event | null>()

const isClick = (e?: Event): e is Event => e?.type === 'click'

/** Renders nothing; its effect runs once the Island root has committed. */
const OnCommit = ({ run }: { readonly run: () => void }) => {
  useEffect(run, [])
  return null
}

const EMPTY = { __html: '' }
const NONE: Provide = []

/**
 * Distinct Tags sharing a key across the app and component entries are `DuplicateTag`, as in one provide set;
 * the same Tag in both shadows, as a nested LayerProvider does.
 */
const assertNoDuplicateTag = (app: Provide, component: Provide) => {
  if (component.length === 0 || app.length === 0) return
  validateProvide([...app, ...component])
}

/** Logs a thrown error and renders nothing, for this Island only. */
class Boundary extends Component<{ readonly name: string; readonly children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  override componentDidCatch(e: unknown) {
    console.error(`[island ${this.props.name}]`, e)
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}

export const defineIslands = <M extends Record<string, IslandLoader>>(map: M, opts: DefineIslandsOptions = {}) => {
  const appProvide = opts.provide ?? NONE
  const app = sharedAppScope(appProvide)
  const serverApp = processAppScope(appProvide)
  /** Server only: opens this render's component scope on the process-lifetime app scope. */
  const ServerScope = ({ provide, children }: { readonly provide: Provide; readonly children: ReactNode }) => (
    <LayerProvider provide={provide} appScope={use(serverApp())}>
      {children}
    </LayerProvider>
  )
  const lazies = new Map<string, ComponentType<unknown>>()
  const serverComponent = (name: string) => {
    let c = lazies.get(name)
    if (!c) lazies.set(name, (c = lazy(map[name]!) as ComponentType<unknown>))
    return c
  }

  return function Island<N extends keyof M & string>({ name, props, hydrate = 'visible', rootMargin, provide = NONE }: IslandProps<M, N>) {
    if (!Object.hasOwn(map, name)) throw new IslandNotFound(`Unknown island "${name}"`)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const el = ref.current!
      const t = pendingUnmount.get(el)
      if (t !== undefined) {
        clearTimeout(t)
        pendingUnmount.delete(el)
      }
      const disarm = arm(el, hydrate, (e) => {
        if (activations.has(el)) {
          // Only the first click while the chunk loads is kept; later ones are dropped.
          if (isClick(e) && pendingClicks.get(el) === null) pendingClicks.set(el, e)
          return
        }
        if (hydrate === 'interaction') pendingClicks.set(el, isClick(e) ? e : null)
        // Assigned before the first await below, so every check sees it.
        let activation!: Activation
        activation = (async () => {
          // `interaction` retries on the next event; other triggers keep the dormant HTML.
          const dropForRetry = () => {
            if (hydrate === 'interaction' && activations.get(el) === activation) {
              activations.delete(el)
              pendingClicks.delete(el)
            }
          }
          let C: ComponentType<any>
          try {
            C = (await map[name]!()).default
          } catch (e) {
            console.error(`[island ${name}] chunk failed to load`, e)
            dropForRetry()
            return undefined
          }
          if (activations.get(el) !== activation) return undefined
          try {
            assertNoDuplicateTag(appProvide, provide)
          } catch (e) {
            console.error(`[island ${name}]`, e)
            return undefined
          }
          let appScope
          try {
            appScope = await app.acquire()
          } catch (e) {
            // Fails this Island; a later activation retries the build.
            console.error(`[island ${name}] app scope failed to build`, e)
            dropForRetry()
            return undefined
          }
          if (activations.get(el) !== activation) {
            app.release()
            return undefined
          }
          const replay = () => {
            const click = pendingClicks.get(el)
            pendingClicks.delete(el)
            if (click) replayClick(el, click)
          }
          // Inside the boundary: Suspense content hydrates in its own pass, after the shell.
          const tree = (
            <Boundary name={name}>
              <LayerProvider provide={provide} appScope={appScope}>
                <Suspense>
                  {createElement(C, props)}
                  <OnCommit run={replay} />
                </Suspense>
              </LayerProvider>
            </Boundary>
          )
          // Server HTML present: attach to it. Fresh client mount (no server HTML): render.
          let root: Root
          if (el.firstChild) root = hydrateRoot(el, tree, { onRecoverableError: (e) => console.error(`[island ${name}]`, e) })
          else {
            root = createRoot(el)
            root.render(tree)
          }
          return {
            unmount: () => {
              root.unmount()
              app.release()
            },
          }
        })()
        activations.set(el, activation)
      }, { rootMargin })
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
      assertNoDuplicateTag(appProvide, provide)
      return (
        <div data-island={name} ref={ref}>
          <Suspense>
            <ServerScope provide={provide}>{createElement(serverComponent(name), props)}</ServerScope>
          </Suspense>
        </div>
      )
    }
    // Client: empty innerHTML + suppressHydrationWarning keeps the server DOM untouched,
    // and the constant props mean a wrapper re-render never rewrites it.
    return <div data-island={name} ref={ref} dangerouslySetInnerHTML={EMPTY} suppressHydrationWarning />
  }
}
