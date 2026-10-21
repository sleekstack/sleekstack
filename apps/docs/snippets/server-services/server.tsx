/** @jsxImportSource @sleekstack/ui */
import { router, routes } from '@sleekstack/router'
import { start } from '@sleekstack/start'
import services from 'virtual:sleek/server-registry'
import { ProfilesLive } from './profiles.server'

const app = router({
  table: routes({ home: '/' }),
  pages: { home: { render: () => <h1>Profiles</h1> } },
  notFound: () => <h1>Not found</h1>,
})

// The generated registry serves `POST /_sleek/fn/Profiles.rename` and `Profiles.count`; the layer implements them.
export const server = start({ router: app, layer: ProfilesLive, services })
