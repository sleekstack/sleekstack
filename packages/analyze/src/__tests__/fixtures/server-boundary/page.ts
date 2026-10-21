import { deep } from './deep.server' // @error ServerFileInClientGraph
import { type Row } from './typed.server'
export type { Db } from './typed.server'

export const rows: Row[] = [deep]
export const lazy = () => import('./lazy.server') // @error ServerFileInClientGraph
