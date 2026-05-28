# sleekstack (CLI shim)

This package is a minimal top-level CLI package named `sleekstack` intended to provide the `sleekstack` executable name on npm. It is a small shim that can forward to the real CLI implementation (for example `@sleekstack/cli`) once you publish or implement it.

Publishing steps (once you own the name):

```bash
# from repo root
pnpm install
# from package dir
cd packages/cli
npm login
npm publish --access public
```

If the name is already taken, see the notes in the repo README about requesting transfers from npm support or publishing under `@sleekstack/cli` instead.

