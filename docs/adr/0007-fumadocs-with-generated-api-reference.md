# Docs site on Fumadocs, with a generated API reference

`apps/docs` is a Next.js 15 App Router site on Fumadocs (`fumadocs-core`/`fumadocs-ui` 15.8.5, `fumadocs-mdx` 12). The API reference is generated at build time: TypeDoc with `typedoc-plugin-markdown` renders one page per package entry point (core, next, react, kit, `kit/next`, `kit/react`) into `content/docs/api/`, which is build output and not committed. A shared resolver reads the entry points from each package's `exports`/`types`, so the generator and the coverage test cannot disagree. Guides are hand-written MDX, and every code sample in them is an `<include>` of a file under `apps/docs/snippets/`, which `tsc` typechecks against the real packages, so an API change breaks the docs typecheck instead of silently staling a sample.

## Considered options

- **Nextra**: rejected — Pages Router heritage and weaker App Router support than Fumadocs.
- **Docusaurus**: rejected — a separate React/webpack stack beside the repo's Next 15 apps.
- **TypeDoc-only site**: rejected — no place for the narrative (concepts, lifetimes, errors).
- **Hand-written MDX reference**: rejected — goes stale as soon as a signature changes.
- **Fumadocs + generated reference + included snippets** *(chosen)*: App Router-native, matches the workspace stack, and both the reference and the samples are checked against the code. Fumadocs 16 needs Next 16 and React 19.2, so 15.8.5 is pinned until the apps move.
