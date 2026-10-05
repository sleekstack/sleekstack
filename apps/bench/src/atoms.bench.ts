import { bench, describe } from 'vitest'
import { atomScenarios, type Body, check, type Library } from './scenarios'

for (const scenario of atomScenarios) {
  for (const size of scenario.sizes) {
    const caseName = `atoms/${scenario.name}${scenario.sizes.length > 1 ? ` n=${size}` : ''}`
    const entries = Object.entries(scenario.adapters) as Array<
      [Library, NonNullable<(typeof scenario.adapters)[Library]>]
    >
    for (const [lib, a] of entries) if (a === 'n/a') console.log(`${caseName}: ${lib} n/a`)
    const live = entries.filter((e): e is [Library, Exclude<(typeof e)[1], 'n/a'>] => e[1] !== 'n/a')
    // Fresh instances for the check, so the measured bodies start from setup state.
    await check(caseName, await Promise.all(live.map(async ([lib, make]) => [lib, await make(size)] as const)))
    const bodies: Array<readonly [Library, Body]> = await Promise.all(
      live.map(async ([lib, make]) => [lib, await make(size)] as const),
    )
    describe(caseName, () => {
      for (const [lib, body] of bodies) bench(lib, body as () => void)
    })
  }
}
