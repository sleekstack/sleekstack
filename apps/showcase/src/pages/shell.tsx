/** @jsxImportSource @sleekstack/ui */
import { ProjectNav } from '../modules/projects'
import { useResetTaskView } from '../modules/tasks'

/** The project links; opening one also clears the tasks module's open task and filter. */
export const ProjectSwitcher = function* () {
  const reset = yield* useResetTaskView()
  return <ProjectNav onOpen={reset} />
}
