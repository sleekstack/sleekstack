import { Schema } from 'effect'

export const User = Schema.Struct({ name: Schema.String })
const Hidden = Schema.String
export type { Hidden }
export declare const Declared: typeof Schema.String
export const NotSchema = 1
