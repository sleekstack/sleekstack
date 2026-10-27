import { defineRecord, type RecordAdapter, type RecordNotFound, type RecordRejected } from '@sleekstack/model'
import { Context, Schema } from 'effect'

type UserWire = { readonly id: string; readonly name: string }

/**
 * Client-safe: the browser gets the Layer generated from `server/routes/api/users/[id].controller.ts`, the server the
 * Layer File `server/user.layer.ts`.
 */
export class UserApi extends Context.Tag('UserApi')<
  UserApi,
  RecordAdapter<UserWire, Omit<UserWire, 'id'>, RecordNotFound | RecordRejected>
>() {}

/** A user, served by its Controller: `record.find` and `commit` reach the server's table over HTTP. */
export const User = defineRecord('user', {
  fields: { id: Schema.String, name: Schema.String.pipe(Schema.minLength(1, { message: () => 'Enter a name' })) },
  adapter: UserApi,
})
