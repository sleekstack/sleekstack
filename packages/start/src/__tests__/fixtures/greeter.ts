import { Service } from '../../index'

/** A Service file a test runs again under another query, as a dev reload does. */
export class Greeter extends Service<Greeter>()('test/Greeter') {
  *greet() {
    return 'hello'
  }
}

/** `Greeter` again from this file, its `Service<Self>()(...)` call on another line, as after an edit and a reload. */
export const movedGreeter = (): typeof Greeter =>
  class Greeter extends Service<Greeter>()('test/Greeter') {
    *greet() {
      return 'moved'
    }
  }

/** The key `test/Rows` again from this file, on a class with the test file's class name. */
export const rowsAgain = () => class Shared extends Service<unknown>()('test/Rows') {}.Default
