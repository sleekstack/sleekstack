/**
 * Whether a server-function call may run: its `Origin` is the request's own or one of `allowed`. Without an `Origin`
 * only a browser's `Sec-Fetch-Site: same-origin` passes, so a client that sends neither is refused.
 */
export const allowedOrigin = (request: Request, allowed: ReadonlyArray<string>): boolean => {
  const origin = request.headers.get('origin')
  if (origin === null) return request.headers.get('sec-fetch-site') === 'same-origin'
  return origin === new URL(request.url).origin || allowed.includes(origin)
}
