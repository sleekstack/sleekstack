import { Controller, type Gen } from '@sleekstack/start'

type Local = Gen<void>

export default class extends Controller() {
  *GET() {} // @error ControllerMethodShape
  *POST(): Local {} // @error ControllerMethodShape
}
