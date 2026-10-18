# @sleekstack/ui-vite

Build pipeline for `@sleekstack/ui` apps. `compileMdx` turns an MDX page into a module that exports its component and `frontmatter`, using the ui JSX runtime.

- `<include>path</include>` expands to a code block read from the file (path relative to the page).
- Code fences are highlighted at build time with shiki (light and dark). Highlighter inline styles become classes; `createStyleSheet().css()` is the one stylesheet for all pages.
- Headings get ids; tables, links and lists are GitHub-flavored markdown.
- Errors read `file:line: reason`, including an unknown fence language and a missing include file.
