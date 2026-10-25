import { Controller, type Gen } from '@sleekstack/start'
import { Effect } from 'effect'

export default class extends Controller() {
  *GET(): Gen<void> {}
}

export const POST = () => Effect.void // @error ControllerMethodShape
export type PUT = string
