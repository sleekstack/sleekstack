import { hydrateMount } from '@sleekstack/ui'
import { site } from './site'

const errors: unknown[] = []
Object.assign(window, { sleekErrors: errors })
void site(location.pathname).then(({ app, layer }) =>
  hydrateMount(app, { layer, container: document.getElementById('app')!, onError: (c) => errors.push(c) }).then(() =>
    Object.assign(window, { sleekHydrated: true }),
  ),
)
