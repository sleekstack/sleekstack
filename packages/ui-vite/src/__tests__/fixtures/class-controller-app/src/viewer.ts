import { Context } from 'effect'

/** Who calls: the directory `wrap` reads it from a header, the Manifest's `wrap` gives `rpc`. */
export class Viewer extends Context.Tag('Viewer')<Viewer, string>() {}
