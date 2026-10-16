/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { startTransition, useAtomValue, useSetAtom } from '@sleekstack/ui'
import { ProjectNav } from '../modules/projects'
import { useResetTaskView } from '../modules/tasks'
import { BoundaryDemo } from './boundary'
import { DevtoolsDemo } from './devtools'
import { TypedDomDemo } from './dom'
import { LazyDemo } from './lazy'
import { ModelDraftDemo } from './model'
import { PortalDemo } from './portal'
import { ProjectPage } from './project'
import { RouterDemo } from './router'
import { TransitionsDemo } from './transitions'

const PAGES = [
  ['board', 'Board and forms'],
  ['dom', 'Typed DOM'],
  ['lazy', 'lazy'],
  ['transitions', 'Transitions'],
  ['portal', 'Portal'],
  ['boundary', 'Boundary reset'],
  ['model', 'Model and Draft'],
  ['router', 'Router'],
  ['devtools', 'Devtools'],
] as const
type Page = (typeof PAGES)[number][0]

/** The page on screen. */
const pageAtom = Atom.make<Page>('board')

/** The project links; opening one also clears the tasks module's open task and filter. */
const ProjectSwitcher = function* () {
  const reset = yield* useResetTaskView()
  return <ProjectNav onOpen={reset} />
}

/** The shell's page links. A transition: the open page stays until the next one has loaded (no fallback flash). */
export const PageNav = function* () {
  const current = yield* useAtomValue(pageAtom)
  const open = yield* useSetAtom(pageAtom)
  return (
    <nav className="pages">
      {PAGES.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={id === current ? 'page current' : 'page'}
          data-page={id}
          onClick={() => startTransition(() => open(id))}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

/** The open page. */
export const PageOutlet = function* () {
  const page = yield* useAtomValue(pageAtom)
  if (page === 'dom') return <TypedDomDemo />
  if (page === 'lazy') return <LazyDemo />
  if (page === 'transitions') return <TransitionsDemo />
  if (page === 'portal') return <PortalDemo />
  if (page === 'boundary') return <BoundaryDemo />
  if (page === 'model') return <ModelDraftDemo />
  if (page === 'router') return <RouterDemo />
  if (page === 'devtools') return <DevtoolsDemo />
  return (
    <>
      <ProjectSwitcher />
      <ProjectPage />
    </>
  )
}
