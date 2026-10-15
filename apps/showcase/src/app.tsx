/** @jsxImportSource @sleekstack/ui */
import { Provider } from '@sleekstack/ui'
import { ViewerLive } from './layers'
import { Header, Team } from './modules/identity'
import { PageNav, PageOutlet } from './pages/shell'

/** The whole page, viewed as `viewer`: one `Provider` scopes the Viewer for every component under it. */
export const App = ({ viewer }: { viewer: string }) => (
  <Provider layer={ViewerLive(viewer)}>
    <Header />
    <Team />
    <PageNav />
    <main>
      <PageOutlet />
    </main>
  </Provider>
)
