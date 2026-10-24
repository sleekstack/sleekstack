import { Layer } from 'effect'
import { SameB } from '../services'

export default Layer.succeed(SameB, {}) // @error LayerFileConflict
