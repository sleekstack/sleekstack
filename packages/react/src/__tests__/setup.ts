import { configure } from '@testing-library/react'

// CI runners stall; the default 1000 ms `waitFor` timeout flaked on trivially resolving layers.
configure({ asyncUtilTimeout: 5000 })
