import { hydrateMount } from '@sleekstack/ui'
import { site } from './site'

const { app, layer } = await site(location.pathname)
await hydrateMount(app, { layer, container: document.getElementById('app')!, onError: (c) => console.error(c) })
