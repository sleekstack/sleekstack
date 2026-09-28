import { layer, module, snapshot, tag } from '@sleekstack/kit'

interface Mailer { send(to: string): void }
const Mailer = tag<Mailer>('Mailer')

const MailModule = module({ name: 'mail', provide: [layer(Mailer, { send: () => {} })], exports: [Mailer] })

// The app's own Mailer shadows the one it imports; no override API is involved.
const sent: string[] = []
export const AppModule = module({
  name: 'app',
  imports: [MailModule],
  provide: [layer(Mailer, { send: (to) => void sent.push(to) })],
})

console.log(snapshot(AppModule).shadowing)
