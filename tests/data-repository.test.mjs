import test from 'node:test'
import assert from 'node:assert/strict'
import { createRepository, StorageError } from '../node-functions/_lib/repository.js'
import { createHandler } from '../node-functions/[[default]].js'

function backend() {
  const values = new Map()
  return {
    values,
    get: async (key) => values.has(key) ? structuredClone(values.get(key)) : null,
    setJSON: async (key, value) => { values.set(key, structuredClone(value)) },
    delete: async (key) => { values.delete(key) },
  }
}
const password = 'test-password'
const apiRequest = (path, options) => new Request('https://example.com/api/' + path, options)

async function login(handler) {
  const setup = await handler({ request: apiRequest('setup', { method: 'POST', body: JSON.stringify({ password, confirmPassword: password }) }) })
  assert.equal(setup.status, 201)
  const response = await handler({ request: apiRequest('login', { method: 'POST', body: JSON.stringify({ password: password }) }) })
  assert.equal(response.status, 200)
  return (await response.json()).token
}

async function save(handler, token, patch) {
  return handler({ request: apiRequest('admin/data', { method: 'PUT', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify(patch) }) })
}

test('empty stores use independent defaults and legacy partial data is merged', async () => {
  const db = backend()
  const repository = createRepository(() => db)
  const first = await repository.readData()
  first.site.title = 'local mutation'
  assert.notEqual((await repository.readData()).site.title, 'local mutation')
  await db.setJSON('likegirl_site_data', { site: { title: '旧站点' } })
  const migrated = await repository.readData()
  assert.equal(migrated.site.title, '旧站点')
  assert.equal(typeof migrated.site.writing, 'string')
  assert.ok(Array.isArray(migrated.stories))
})

test('read failures and corrupt records never fall back to defaults', async () => {
  const repository = createRepository(() => ({ get: async () => { throw new Error('unavailable') } }))
  await assert.rejects(repository.readData(), StorageError)
  for (const value of ['invalid', [], { site: false }, { stories: {} }]) {
    await assert.rejects(createRepository(() => ({ get: async () => value })).readData(), StorageError)
  }
})

test('saved settings are immediately public across handlers and sessions survive changes', async () => {
  const db = backend()
  const handler = createHandler(createRepository(() => db))
  const token = await login(handler)
  assert.equal((await save(handler, token, { site: { title: '新标题', blur: false } })).status, 200)
  assert.equal((await save(handler, token, { site: { writing: '即时生效' } })).status, 200)
  // A cold instance must read the same shared data without relying on process memory.
  const coldHandler = createHandler(createRepository(() => db))
  const response = await coldHandler({ request: apiRequest('data') })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const data = await response.json()
  assert.equal(data.site.title, '新标题')
  assert.equal(data.site.writing, '即时生效')
  assert.equal(data.site.blur, false)
  assert.equal(Object.hasOwn(data, 'blockedIps'), false)
  assert.equal((await save(coldHandler, token, { site: { card1: '新卡片' } })).status, 200)
})

test('failed reads block saves; failed writes return 503 and retain stored data', async (t) => {
  t.mock.method(console, 'error', () => {})
  const db = backend()
  const repository = createRepository(() => db)
  await repository.writeData(await repository.readData())
  const before = structuredClone(db.values.get('likegirl_site_data'))
  const handler = createHandler(repository)
  const token = await login(handler)
  const originalRead = db.get
  db.get = async () => { throw new Error('read failed') }
  assert.equal((await save(handler, token, { site: { title: 'should not save' } })).status, 503)
  const publicResponse = await handler({ request: apiRequest('data') })
  assert.equal(publicResponse.status, 503)
  assert.equal((await publicResponse.json()).code, 'STORAGE_UNAVAILABLE')
  db.get = originalRead
  db.setJSON = async () => { throw new Error('write failed') }
  assert.equal((await save(handler, token, { site: { title: 'should not save' } })).status, 503)
  assert.deepEqual(db.values.get('likegirl_site_data'), before)
})
