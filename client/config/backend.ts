/** Resolve one HTTP origin and derive the matching WebSocket origin at build time. */
export function backendEndpoints(value: string | undefined, production: boolean) {
  if (!value && production) throw new Error('Set AVALON_API_ORIGIN to your HTTPS backend origin for production builds')
  const url = new URL(value || 'http://localhost:3000')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('AVALON_API_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment')
  }
  if (production && url.protocol !== 'https:') throw new Error('Production AVALON_API_ORIGIN must use HTTPS')
  return { http: url.origin, ws: url.origin.replace(/^http/, 'ws') }
}
