import { json } from './http.js'

// Read-only probes. Timeout bounds the response; the storage SDK read itself
// cannot be cancelled, so no retry or background polling is scheduled here.
export function createHealthHandler(repository, { timeoutMs = 3000 } = {}) {
  return async function health(request, path) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return json({ error: 'Method not allowed' }, 405, { allow: 'GET, HEAD' })
    }
    const started = performance.now()
    let result = { ok: true, status: 'ok' }
    if (path !== 'health/live') {
      let timer
      try {
        const checks = await Promise.race([
          Promise.allSettled([
            Promise.resolve().then(() => repository.readData()),
            Promise.resolve().then(() => repository.readAuth()),
          ]),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
          }),
        ])
        const data = checks[0].status === 'fulfilled'
        const auth = checks[1].status === 'fulfilled'
        const initialized = auth ? Boolean(checks[1].value) : null
        const storage = data && auth
        const ready = storage && initialized === true
        const ok = path === 'health/ready' ? ready : storage
        result = {
          ok, status: ok ? 'ok' : 'unavailable', storage, initialized,
          checks: { data, auth },
          ...(storage ? {} : { code: 'STORAGE_UNAVAILABLE' }),
          ...(storage && !ok ? { code: 'NOT_INITIALIZED' } : {}),
        }
      } catch {
        result = { ok: false, status: 'unavailable', storage: false, initialized: null, code: 'HEALTH_CHECK_TIMEOUT' }
      } finally {
        clearTimeout(timer)
      }
    }
    result.timestamp = new Date().toISOString()
    result.durationMs = Math.round(performance.now() - started)
    const response = json(result, result.ok ? 200 : 503)
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response
  }
}
