import { Effect } from 'effect'

export const get = () => Effect.void // @error ControllerMethodShape
export const Post = () => Effect.void // @error ControllerMethodShape
export default () => Effect.void // @error ControllerMethodShape
export interface Delete {
  readonly erased: true
}
