import { startRouter } from '@sleekstack/router'
import { app } from './app'

export const started = startRouter(app, { container: document.getElementById('app')!, onError: console.error })
