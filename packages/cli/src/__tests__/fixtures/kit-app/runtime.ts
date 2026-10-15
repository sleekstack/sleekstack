import type { FinalizerError } from '@sleekstack/kit'
import { configureRuntime, query, type RuntimeConfig } from '@sleekstack/kit/next'
import { AppModule } from './modules'
import { ActivityLog } from './tags'

// A kit operation body passes no request layer of its own: it adds no root.
function onFinalizerError(e: FinalizerError): void {
  void query(function* () {
    ;(yield* ActivityLog).record(`finalizer error: ${e.message}`)
  })
}

const runtimeConfig: RuntimeConfig = { provide: [AppModule], onFinalizerError }

configureRuntime(runtimeConfig)
