/** @jsxImportSource @sleekstack/ui */
import { Provider } from '@sleekstack/ui'
import { Backlog, DetailPanel, Header, ProjectBoard, Selected, Team, Toolbar } from './components'
import { MISSING_TASK } from './domain'
import { ViewerLive } from './infrastructure'

/** The whole page, viewed as `viewer`: one `Provider` scopes the Viewer for every component under it. */
export const App = ({ viewer }: { viewer: string }) => (
  <Provider layer={ViewerLive(viewer)}>
    <Header />
    <Toolbar />
    <main>
      <Team />
      <ProjectBoard projectId="p1" />
      <ProjectBoard projectId="missing" />
      <Selected />
      <DetailPanel id={MISSING_TASK} />
      <Backlog projectId="p2" />
    </main>
  </Provider>
)
