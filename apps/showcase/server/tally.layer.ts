import { Context, Layer, Ref } from 'effect'

/** The tally's count, held by the server process: the Controller's REST face and its RPC face share it. */
export class TallyCount extends Context.Tag('showcase/server/TallyCount')<TallyCount, Ref.Ref<number>>() {}

export default Layer.effect(TallyCount, Ref.make(0))
