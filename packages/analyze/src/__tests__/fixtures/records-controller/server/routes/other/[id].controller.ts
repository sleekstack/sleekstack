import { Article } from '../../../article'

const serve = (record: unknown) => record

/** A default export that is not a `records` call is not served, as before. */
export default serve(Article) // @error ControllerMethodShape
