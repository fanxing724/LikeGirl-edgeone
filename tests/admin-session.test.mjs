import test from 'node:test'
import assert from 'node:assert/strict'
import { env } from '../node-functions/_lib/env.js'
import { sign, verify } from '../node-functions/_lib/auth.js'
import { createRepository } from '../node-functions/_lib/repository.js'
import { createHandler } from '../node-functions/[[default]].js'

const secret = 's'.repeat(32)
const request = (headers) => new Request('https://example.com/api/admin/data', { headers })
const settings = { ADMIN_PASSWORD: 'test-password', SESSION_SECRET: secret }

test('Node environment variables are supported, with context values taking priority', () => {
  const previous = process.env.SESSION_SECRET
  try {
    process.env.SESSION_SECRET = secret
    assert.equal(env({}, 'SESSION_SECRET'), secret)
    assert.equal(env({ env: { SESSION_SECRET: 'configured' } }, 'SESSION_SECRET'), 'configured')
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = previous
  }
})

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

test('login, cookie-based reload, logout, and missing configuration return correct responses', async () => {
  const handler = createHandler(createRepository(() => ({ get: async () => null })))
  const login = await handler({ env: settings, request: new Request('https://example.com/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) }) })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly; SameSite=Strict/)
  assert.match(cookie, /; Secure/)
  const loggedIn = await handler({ env: settings, request: request({ cookie: cookie.split(';')[0] }) })
  assert.equal(loggedIn.status, 200)
  assert.equal(typeof (await loggedIn.json()).site.title, 'string')
  const logout = await handler({ request: new Request('https://example.com/api/logout', { method: 'POST' }) })
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await handler({ env: settings, request: request({}) })).status, 401)
  const misconfigured = await handler({ env: { SESSION_SECRET: '' }, request: request({}) })
  assert.equal(misconfigured.status, 503)
  assert.match((await misconfigured.json()).error, /安全配置/)
})
