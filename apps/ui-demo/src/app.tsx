/** @jsxImportSource @sleekstack/ui */
import { Provider } from '@sleekstack/ui'
import { ProjectPage } from './presentation/board'
import { Header, ProjectNav, Team } from './presentation/layout'
import { ViewerLive } from './infrastructure'

/** The whole page, viewed as `viewer`: one `Provider` scopes the Viewer for every component under it. */
export const App = ({ viewer }: { viewer: string }) => (
  <Provider layer={ViewerLive(viewer)}>
    <Header />
    <Team />
    <ProjectNav />
    <main>
      <ProjectPage />
    </main>
  </Provider>
)
