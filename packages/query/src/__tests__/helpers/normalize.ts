// Strips what only the stream writes: placeholder markers, boundary templates and inline scripts (swap runtime and calls).
export const normalize = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<template data-sleek-b="[^"]*"><\/template>/g, '')
    .replace(/<!--\/?sleek-p(:[^-]*)?-->/g, '')
