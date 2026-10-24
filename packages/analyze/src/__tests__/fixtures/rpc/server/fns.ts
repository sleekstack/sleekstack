import { serverFn } from '@sleekstack/start'
import { Schema } from 'effect'

export const ping = serverFn('Ping', { input: Schema.Void, success: Schema.Void })(function* () {})
