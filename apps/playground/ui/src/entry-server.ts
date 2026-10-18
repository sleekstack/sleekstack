import { handle } from '@sleekstack/router'
import { scripts } from 'virtual:sleekstack/client'
import { app } from './app'

const document = {
  before: `<!doctype html><html><head><meta charset="utf-8"><title>SleekStack ui example</title>${scripts}</head><body><div id="app">`,
  after: '</div></body></html>',
}

export default (request: Request): Promise<Response> => handle(app, request, { stream: true, document })
