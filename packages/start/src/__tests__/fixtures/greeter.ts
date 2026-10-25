import { Service } from '../../index'

/** A Service file a test runs again under another query, as a dev reload does. */
export class Greeter extends Service<Greeter>()('test/Greeter') {
  *greet() {
    return 'hello'
  }
}

/** Defines the key `test/Rows` again from this file. */
export const rowsAgain = () => Service<unknown>()('test/Rows')
