import { accessors, Service } from '@sleekstack/start'
import { Clock } from './greeter-effect'

/** The Service Class form: the dependency is declared once and is on `this`; each generator method runs as an Effect. */
export class Greeter extends Service<Greeter>()('app/GreeterClass', { clock: Clock }) {
  *greet(name: string) {
    return `Hello ${name} at ${this.clock.now()}`
  }

  *greetAll(names: ReadonlyArray<string>) {
    const greetings: Array<string> = []
    for (const name of names) greetings.push(yield* this.greet(name))
    return greetings
  }
}

/** A caller that is not a generator reaches the methods as Effects. */
export const greetAda = accessors(Greeter).greet('Ada')
