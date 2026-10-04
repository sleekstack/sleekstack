/** @jsxImportSource @sleekstack/ui */
import { mount } from '@sleekstack/ui'
import { App } from './components'
import { AppWithQueriesLive } from './domain'

for (const [id, viewer] of [['ada', 'u1'], ['grace', 'u2']] as const)
  void mount(<App viewer={viewer} />, { layer: AppWithQueriesLive(), container: document.getElementById(id)! })
