import { mount } from '@sleekstack/ui'
import { app, UserRepoLive } from './app'

void mount(app('1'), { layer: UserRepoLive, container: document.getElementById('found')! })
void mount(app('2'), { layer: UserRepoLive, container: document.getElementById('missing')! })
