import { startRouter } from '@sleekstack/router'
import { Layer } from 'effect'
import { pages, ServerFunctionsClient } from './app'
import { AppLive, QueriesLive } from './layers'

void startRouter(pages, {
  layer: Layer.mergeAll(AppLive, QueriesLive, ServerFunctionsClient),
  container: document.getElementById('app')!,
})
