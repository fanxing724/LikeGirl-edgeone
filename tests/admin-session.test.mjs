import test from 'node:test'
import assert from 'node:assert/strict'
import { sign, verify } from '../node-functions/_lib/auth.js'
import { createRepository } from '../node-functions/_lib/repository.js'
import { createHandler } from '../node-functions/[[default]].js'

const secret = 's'.repeat(32)
const request = (headers) => new Request('https://example.com/api/admin/data', { headers })

test('valid sessions work through Bearer headers and HttpOnly cookies', async () => {
  const token = await sign({ role: 'admin', exp: Date.now() + 60000 }, secret)
  assert.equal(await verify(request({ authorization: 'Bearer ' + token }), secret), true)
  assert.equal(await verify(request({ cookie: 'other=1; lg_session=' + token }), secret), true)
})

test('expired, tampered, wrong-key, and missing sessions are rejected', async () => {
  const expired = await sign({ role: 'admin', exp: Date.now() - 1 }, secret)
  const valid = await sign({ role: 'admin', exp: Date.now() + 60000 }, secret)
  assert.equal(await verify(request({ cookie: 'lg_session=' + expired }), secret), false)
  assert.equal(await verify(request({ authorization: 'Bearer x' + valid }), secret), false)
  assert.equal(await verify(request({ authorization: 'Bearer ' + valid }), 'x'.repeat(32)), false)
  assert.equal(await verify(request({}), secret), false)
  assert.equal(await verify(request({ authorization: 'Bearer ' + valid }), ''), false)
})

test('initialized login, cookie-based reload, and logout work without environment variables', async () => {
  const values = new Map()
  const handler = createHandler(createRepository(() => ({ get: async key => values.get(key) ?? null, setJSON: async (key, value) => values.set(key, value) })))
  const setup = await handler({ request: new Request('https://example.com/api/setup', { method: 'POST', body: JSON.stringify({ password: 'test-password', confirmPassword: 'test-password' }) }) })
  assert.equal(setup.status, 201)
  const login = await handler({ request: new Request('https://example.com/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) }) })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly; SameSite=Strict/)
  assert.match(cookie, /; Secure/)
  const loggedIn = await handler({ request: request({ cookie: cookie.split(';')[0] }) })
  assert.equal(loggedIn.status, 200)
  assert.equal(typeof (await loggedIn.json()).site.title, 'string')
  const logout = await handler({ request: new Request('https://example.com/api/logout', { method: 'POST' }) })
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await handler({ request: request({}) })).status, 401)
  const emptyHandler = createHandler(createRepository(() => ({ get: async () => null })))
  const uninitialized = await emptyHandler({ request: request({}) })
  assert.equal(uninitialized.status, 409)
  assert.equal((await uninitialized.json()).code, 'NOT_INITIALIZED')
})
