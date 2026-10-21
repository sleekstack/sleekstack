import { serverFn, start } from '@sleekstack/start'
import { Context, Layer, Ref } from 'effect'
import { AppLive } from '../src/layers'
import { people } from '../src/pages/router'
import { addItem, DuplicateItem } from '../src/pages/items'
import services from 'virtual:sleek/server-registry'
import { TallyLive } from './tally.server'

/** The list, held by the server process: a server-only service, absent from every client layer. */
export class Items extends Context.Tag('showcase/server/Items')<Items, Ref.Ref<ReadonlyArray<string>>>() {}
const ItemsLive = Layer.effect(Items, Ref.make<ReadonlyArray<string>>([]))

/** Adds a title and answers the whole list; a title already on it fails with the declared `DuplicateItem`. */
export const addItemFn = serverFn(
  addItem.id,
  addItem,
)(function* ({ title }) {
  const items = yield* Items
  if ((yield* Ref.get(items)).includes(title)) return yield* new DuplicateItem({ title })
  return yield* Ref.updateAndGet(items, (list) => [...list, title])
})

/**
 * The server entry: the router demo's pages, the server functions and the generated Server Service registry, on the
 * app's layer plus the server's own (`TallyLive` implements the `Tally` contract in-process).
 */
export const app = start({
  router: people,
  layer: Layer.mergeAll(AppLive, ItemsLive, TallyLive),
  functions: [addItemFn],
  services,
})
