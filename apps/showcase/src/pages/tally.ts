import { Data } from 'effect'

/**
 * The tally is at its limit: the declared error of `server/routes/api/tally.controller.ts`, client-safe so it crosses
 * the wire as this class.
 */
export class TallyLimit extends Data.TaggedError('TallyLimit')<{ readonly limit: number }> {}
