import { Controller, type Gen, Request } from '@sleekstack/start'
import { Audit, Clock, Users } from '../../../services'

/** `Users` comes from `start({ layer })`, `Clock` from a Layer File, `Request` from the request services; nobody provides `Audit`. */
export default class Declared extends Controller({
  audit: Audit, // @error MissingDependency
  users: Users,
  clock: Clock,
  request: Request,
}) {
  *GET(): Gen<void> {}
}
