import { Controller } from '@sleekstack/start'

export default class extends Controller() { // @error ControllerMethodShape
  *get() {}
}
