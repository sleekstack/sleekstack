import { Service } from '@sleekstack/start'

/** A Service file the test runs again, as a dev reload does. */
export class Greeter extends Service<Greeter>()('app/Greeter') {
  *greet() {
    return 'hello'
  }
}
