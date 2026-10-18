import { startRouter } from '@sleekstack/router'
import { Layer } from 'effect'
import { pages, ServerFunctionsClient } from './app'
import { AppLive } from './layers'

void startRouter(pages, {
  layer: Layer.merge(AppLive, ServerFunctionsClient),
  container: document.getElementById('app')!,
})
