import { records } from '@sleekstack/start'
import { User } from '../../../../src/modules/users'

/** `GET` and `PATCH /api/users/:id`, through the `UserApi` Layer File (`server/user.layer.ts`). */
export default records(User)
