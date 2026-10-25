import { Controller, type Gen } from '@sleekstack/start'
import { Viewer } from '../../../services'

/** `Viewer` is discharged by the directory wrap above it, inside which the instance is built. */
export default class extends Controller({ viewer: Viewer }) {
  *GET(): Gen<string> {
    return this.viewer.id
  }
}
