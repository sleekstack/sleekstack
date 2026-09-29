import { layer, module, tag, type Layer } from '@sleekstack/kit'

const A = tag<string>('A')
const B = tag<string>('B')
const C = tag<string>('C')
const D = tag<string>('D')
const tags = [A, B] as const

const looped: Layer<string>[] = []
for (const t of tags) looped.push(layer(t, 'x'))
declare const flag: boolean
if (flag) looped.push(layer(C, 'c'))

export const Mapped = module({ name: 'Mapped', provide: tags.map((t) => layer(t, 'x')) })
export const Looped = module({ name: 'Looped', provide: looped })

declare const loose: any[]
export const Loose = module({ name: 'Loose', provide: loose.map((t) => layer(t, 'x')) }) // @error Computed
declare const widened: Layer<any>[]
export const Widened = module({ name: 'Widened', provide: widened }) // @error Computed

const makeLayer = (t: typeof A) => layer(t, 'x')
declare const pick: boolean
const shared = tags.map(makeLayer)
const Left = module({ name: 'Left', provide: shared })
const Right = module({ name: 'Right', provide: shared })
export const Named = module({ name: 'Named', imports: [Left, Right], provide: [pick ? layer(C, 'c') : layer(D, 'd')] })
