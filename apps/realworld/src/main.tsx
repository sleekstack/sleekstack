import { startRouter } from '@sleekstack/router'
import { Layer } from 'effect'
import ServerServicesLive from 'virtual:sleek/server'
import { pages, ServerFunctionsClient } from './app'
import { AppLive, QueriesLive } from './layers'

void startRouter(pages, {
  layer: Layer.mergeAll(AppLive, QueriesLive, ServerFunctionsClient, ServerServicesLive),
  container: document.getElementById('app')!,
})
