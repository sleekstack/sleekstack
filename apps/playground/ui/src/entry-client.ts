import { startRouter } from '@sleekstack/router'
import { app } from './app'
import './app.css'

export const started = startRouter(app, { container: document.getElementById('app')!, onError: console.error })
