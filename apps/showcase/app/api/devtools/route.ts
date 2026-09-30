/**
 * apps/showcase/app/api/devtools/route.ts
 *
 * Dev-only introspection for <SleekStackDevtools />: the runtime's scope/error buffer plus the
 * analyzer Report of the app root. 404 in production.
 */
import { devtoolsHandler } from '@sleekstack/next/devtools'
import { readReport } from '../../../src/server/report.server'

export const dynamic = 'force-dynamic'

export const GET = devtoolsHandler({ graph: () => readReport('report') })
