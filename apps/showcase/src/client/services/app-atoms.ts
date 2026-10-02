import { Atom } from '@sleekstack/core'

/** Window event fired by the demo toggle; the devtools mount counts it into {@link demoToggles}. */
export const DEMO_TOGGLED = 'showcase:demo-toggled'

/** How many times the demo toggle was pressed this session; shown read-only in the devtools panel. */
export const demoToggles = Atom.make(0)
