import { Controller, type Gen } from '@sleekstack/start'

class Base extends Controller() {}

export default class extends Base { // @error ControllerMethodShape
  *GET(): Gen<void> {}
}
