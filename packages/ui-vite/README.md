# @sleekstack/ui-vite

Build pipeline for `@sleekstack/ui` apps. `compileMdx` turns an MDX page into a module that exports its component and `frontmatter`, using the ui JSX runtime.

- `<include>path</include>` expands to a code block read from the file (path relative to the page).
- Code fences are highlighted at build time with shiki (light and dark). Highlighter inline styles become classes; `createStyleSheet().css()` is the one stylesheet for all pages.
- Headings get ids; tables, links and lists are GitHub-flavored markdown.
- Errors read `file:line: reason`, including an unknown fence language and a missing include file.

## Routes, links and the dev entry

`sleekContent({ content, base?, app })` is the Vite plugin. `virtual:sleek-content` exports `routes` (a `@sleekstack/router` table from the content tree and its `meta.json` order, with `base` prefixed) and `pages` (route name to the compiled page loader); `virtual:sleek-content.css` is the highlighting stylesheet. In dev, a page route and `/_sleek/*` go to the `start` fetch handler exported as `app` by the `app` module; a page added, renamed or removed updates the table without a restart, and a content error shows in the overlay until the next good save. The build fails on a broken internal link or anchor (`assertLinks`, `findBrokenLinks`).
