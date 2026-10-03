import { resume } from '@sleekstack/ui'
import { Layer } from 'effect'
import { countAtom } from './count'

/** The client entry: resumes a server-rendered Counter. No component code, no React. */
export const resumeCounter = (container: Element) =>
  resume({ container, layer: Layer.empty, handlers: { increment: () => import('./increment') }, atoms: { count: countAtom } })
