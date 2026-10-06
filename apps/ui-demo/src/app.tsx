/** @jsxImportSource @sleekstack/ui */
import { Provider } from '@sleekstack/ui'
import { Header, ProjectNav, ProjectPage, Team } from './components'
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
