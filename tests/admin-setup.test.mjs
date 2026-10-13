import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../node-functions/[[default]].js'
import { createRepository } from '../node-functions/_lib/repository.js'

function fixture() {
  const values = new Map()
  const db = { get: async key => values.get(key) ?? null, setJSON: async (key, value) => values.set(key, structuredClone(value)), delete: async key => values.delete(key) }
  const handler = createHandler(createRepository(() => db))
  const call = (path, method = 'GET', body, token) => handler({ request: new Request('https://example.com/api/' + path, { method, ...(body ? { body: JSON.stringify(body) } : {}), headers: token ? { authorization: 'Bearer ' + token } : {} }) })
  return { values, db, call }
}
const password = 'my-password-123'

test('first initialization stores only salted password hash and persistent signing key', async () => {
  const { values, call } = fixture()
  assert.deepEqual(await (await call('setup/status')).json(), { initialized: false })
  const setup = await call('setup', 'POST', { password, confirmPassword: password })
  assert.equal(setup.status, 201)
  const record = values.get('likegirl_admin_auth')
  assert.equal(record.passwordHash.length, 64)
  assert.equal(record.secret.length, 64)
  assert.equal(JSON.stringify(record).includes(password), false)
  assert.deepEqual(await (await call('setup/status')).json(), { initialized: true })
  assert.equal((await call('setup', 'POST', { password: 'other-password', confirmPassword: 'other-password' })).status, 409)
  assert.deepEqual(values.get('likegirl_admin_auth'), record)
  const publicData = await (await call('data')).json()
  assert.equal(JSON.stringify(publicData).includes(record.secret), false)
  const login = await call('login', 'POST', { password })
  assert.equal(login.status, 200)
  const { token } = await login.json()
  const adminData = await (await call('admin/data', 'GET', null, token)).json()
  assert.equal(JSON.stringify(adminData).includes(record.passwordHash), false)
})

test('password validation and mismatch do not initialize; incorrect login is rejected', async () => {
  const { values, call } = fixture()
  assert.equal((await call('setup', 'POST', { password: 'short', confirmPassword: 'short' })).status, 400)
  assert.equal((await call('setup', 'POST', { password, confirmPassword: 'different' })).status, 400)
  assert.equal(values.has('likegirl_admin_auth'), false)
  assert.equal((await call('login', 'POST', { password })).status, 409)
  await call('setup', 'POST', { password, confirmPassword: password })
  assert.equal((await call('login', 'POST', { password: 'wrong-password' })).status, 403)
})

test('storage failure or corrupt auth record cannot reopen initialization', async (t) => {
  t.mock.method(console, 'error', () => {})
  const { values, db, call } = fixture()
  values.set('likegirl_admin_auth', { corrupt: true })
  assert.equal((await call('setup/status')).status, 503)
  assert.equal((await call('setup', 'POST', { password, confirmPassword: password })).status, 503)
  assert.deepEqual(values.get('likegirl_admin_auth'), { corrupt: true })
  db.get = async () => { throw new Error('storage unavailable') }
  assert.equal((await call('setup/status')).status, 503)
})

test('password change requires old password and invalidates existing sessions', async () => {
  const { call } = fixture()
  await call('setup', 'POST', { password, confirmPassword: password })
  const { token } = await (await call('login', 'POST', { password })).json()
  const next = 'new-password-456'
  assert.equal((await call('admin/password', 'POST', { currentPassword: 'wrong', password: next, confirmPassword: next }, token)).status, 403)
  assert.equal((await call('admin/password', 'POST', { currentPassword: password, password: next, confirmPassword: next }, token)).status, 200)
  assert.equal((await call('admin/data', 'GET', null, token)).status, 401)
  assert.equal((await call('login', 'POST', { password })).status, 403)
  assert.equal((await call('login', 'POST', { password: next })).status, 200)
})

test('initialization preserves existing site data and cold instances recover sessions', async () => {
  const { values, db, call } = fixture()
  values.set('likegirl_site_data', { site: { title: '已有小站' } })
  await call('setup', 'POST', { password, confirmPassword: password })
  assert.deepEqual(values.get('likegirl_site_data'), { site: { title: '已有小站' } })
  const { token } = await (await call('login', 'POST', { password })).json()
  const cold = createHandler(createRepository(() => db))
  const response = await cold({ request: new Request('https://example.com/api/admin/data', { headers: { authorization: 'Bearer ' + token } }) })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).site.title, '已有小站')
})


test('failed initial write never reports success or creates an in-memory session', async (t) => {
  t.mock.method(console, 'error', () => {})
  const { values, db, call } = fixture()
  db.setJSON = async () => { throw new Error('write unavailable') }
  assert.equal((await call('setup', 'POST', { password, confirmPassword: password })).status, 503)
  assert.equal(values.has('likegirl_admin_auth'), false)
  assert.deepEqual(await (await call('setup/status')).json(), { initialized: false })
  assert.equal((await call('login', 'POST', { password })).status, 409)
})
