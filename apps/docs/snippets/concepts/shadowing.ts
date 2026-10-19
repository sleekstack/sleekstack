import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Mailer extends Context.Tag('Mailer')<Mailer, { send(to: string): void }>() {}

const MailModule = module({
  name: 'mail',
  entries: [declareLayer(Layer.succeed(Mailer, { send: () => {} }))],
  exports: [Mailer],
})

// The app's own Mailer shadows the one it imports; no override API is involved.
const sent: string[] = []
export const AppModule = module({
  name: 'app',
  imports: [MailModule],
  entries: [declareLayer(Layer.succeed(Mailer, { send: (to) => void sent.push(to) }))],
})

// `sleekstack check --json` lists it in the graph's shadowing: Mailer, shadowed Mailer@mail.
