export type ThemeChoice = 'light' | 'dark' | 'system'

export const themeChoices: ReadonlyArray<ThemeChoice> = ['light', 'dark', 'system']

const storageKey = 'theme'

/**
 * Runs first in the body, before the first paint: an explicit choice becomes `data-theme`; otherwise the CSS media query
 * follows the system. It is rendered as element text, which the renderer HTML-escapes, so it holds no `'`, `"`, `<`, `>` or `&`.
 */
export const themeScript = `try{var t=localStorage.getItem(\`${storageKey}\`);if(t===\`light\`||t===\`dark\`)document.documentElement.dataset.theme=t}catch(e){}`

export const readChoice = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Sets the attribute and remembers an explicit choice; `system` removes both so the system setting decides. */
export const applyChoice = (choice: ThemeChoice): void => {
  const root = document.documentElement
  try {
    if (choice === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, choice)
  } catch {
    // storage blocked: the choice still applies to this page view
  }
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
}
