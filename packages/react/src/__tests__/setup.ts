import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// CI runners stall; the default 1000 ms `waitFor` timeout flaked on trivially resolving layers.
configure({ asyncUtilTimeout: 5000 })

// Vitest runs without globals, so Testing Library does not register its own cleanup: renders from earlier tests in a
// file stayed in the document and `getByTestId` found several matches whenever they had not unmounted by themselves.
afterEach(() => cleanup())
