import { Article } from '../../../article'

const records = (record: unknown) => record

export default records(Article) // @error RecordsRouteShape
