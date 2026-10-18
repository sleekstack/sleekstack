/** @jsxImportSource @sleekstack/ui */
import { useEffect, useLocal } from '@sleekstack/ui'
import { applyChoice, readChoice, themeChoices, type ThemeChoice } from './theme'

/** Light, dark or system. Starts on `system` (what the server renders) and reads the remembered choice after mount. */
export const ThemeSwitcher = function* () {
  const [choice, setChoice] = yield* useLocal<ThemeChoice>('system')
  yield* useEffect(() => setChoice(readChoice()), [])
  const pick = (next: ThemeChoice) => {
    applyChoice(next)
    setChoice(next)
  }
  return (
    <div class="theme-switcher" role="group" aria-label="Theme">
      {themeChoices.map((c) => (
        <button key={c} type="button" aria-pressed={c === choice ? 'true' : 'false'} onClick={() => pick(c)}>
          {c}
        </button>
      ))}
    </div>
  )
}
