/** @jsxImportSource @sleekstack/ui */
import { mount } from '@sleekstack/ui'
import { App } from './components'
import { AppLive } from './domain'

for (const [id, viewer] of [['ada', 'u1'], ['grace', 'u2']] as const)
  void mount(<App viewer={viewer} />, { layer: AppLive, container: document.getElementById(id)! })
