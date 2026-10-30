import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../node-functions/[[default]].js'
import { createHealthHandler } from '../node-functions/_lib/health.js'
import { createRepository } from '../node-functions/_lib/repository.js'
import { createAuthRecord } from '../node-functions/_lib/auth.js'

const request = (path, method = 'GET') => new Request('https://example.com/api/' + path, { method })
const call = (handler, path, method) => handler({ request: request(path, method) })

test('liveness is independent of storage; HEAD is empty and methods are restricted', async () => {
  let reads = 0
  const handler = createHandler({ readData() { reads++; throw Error('secret') }, readAuth() { reads++; throw Error('secret') } })
  assert.equal((await call(handler, 'health/live')).status, 200)
  const head = await call(handler, 'health/live', 'HEAD')
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.equal(head.headers.get('cache-control'), 'no-store')
  assert.equal((await call(handler, 'health/live', 'POST')).status, 405)
  assert.equal(reads, 0)
})

test('empty storage is healthy but not ready until initialized; probes never write', async () => {
  const records = new Map()
  const handler = createHandler(createRepository(() => ({
    get: async key => records.get(key) ?? null,
    setJSON() { assert.fail('health probe must not write') },
  })))
  const healthy = await call(handler, 'health')
  const body = await healthy.json()
  assert.equal(healthy.status, 200)
  assert.equal(body.storage, true)
  assert.equal(body.initialized, false)
  assert.ok(Number.isFinite(Date.parse(body.timestamp)))
  assert.ok(body.durationMs >= 0)
  assert.equal((await call(handler, 'health/ready')).status, 503)
  records.set('likegirl_admin_auth', await createAuthRecord('test-password'))
  assert.equal((await call(handler, 'health/ready')).status, 200)
  const head = await call(handler, 'health/ready', 'HEAD')
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})

test('storage failure or corruption returns 503 without exposing underlying errors', async () => {
  for (const get of [async () => { throw Error('private backend credential') }, async () => 'corrupt']) {
    const handler = createHandler(createRepository(() => ({ get })))
    for (const path of ['health', 'health/ready']) {
      const response = await call(handler, path)
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const body = await response.json()
      assert.equal(body.ok, false)
      assert.equal(body.code, 'STORAGE_UNAVAILABLE')
      assert.equal(JSON.stringify(body).includes('private'), false)
    }
  }
})

test('slow storage is bounded by the probe timeout', async () => {
  const health = createHealthHandler({ readData: () => new Promise(() => {}), readAuth: async () => null }, { timeoutMs: 15 })
  const response = await health(request('health'), 'health')
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'HEALTH_CHECK_TIMEOUT')
})
