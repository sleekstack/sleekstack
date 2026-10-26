import { Controller } from '@sleekstack/start'
import { Effect } from 'effect'

export default class extends Controller({}) {
  GET() { // @error ControllerMethodShape
    return Effect.void
  }
}
