/** @jsxImportSource @sleekstack/ui */
import { mount } from '@sleekstack/ui'
import { App } from './app'
import { AppLive } from './layers'

void mount(<App />, { layer: AppLive, container: document.getElementById('app')! })
