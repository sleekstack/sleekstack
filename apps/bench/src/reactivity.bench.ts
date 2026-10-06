import { bench, describe } from 'vitest'
import { builders, type Lib, reactivityScenarios } from './reactivity'
import { check } from './scenarios'

for (const scenario of reactivityScenarios) {
  const caseName = `reactivity/${scenario.name}`
  const libs = (Object.keys(builders) as Array<Lib>).filter((lib) => {
    const why = scenario.unsupported?.[lib]
    if (why) console.log(`${caseName}: ${lib} n/a (${why})`)
    return !why
  })
  // Fresh graphs for the check, so the measured bodies start from setup state.
  await check(
    caseName,
    libs.map((lib) => [lib as never, builders[lib](scenario.make)] as const),
  )
  const bodies = libs.map((lib) => [lib, builders[lib](scenario.make)] as const)
  describe(caseName, () => {
    for (const [lib, body] of bodies) bench(lib, body as () => void)
  })
}
