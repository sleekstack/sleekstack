import { Articles } from '../server/articles'
import { accessors } from '../server/service'

/** The `Articles` methods as Effects that ask for the service, for a test that pipes them. */
export const articles = accessors(Articles)
