import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../node-functions/[[default]].js', import.meta.url), 'utf8')
const context = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array, Date, process: { env: { SESSION_SECRET: 's'.repeat(32) } } })
vm.runInContext('const encoder = new TextEncoder(); const decoder = new TextDecoder();\n' + source.slice(source.indexOf('function env('), source.indexOf('function json(')) + source.slice(source.indexOf('function b64('), source.indexOf('/* ------------------------------------------------------------------ *\n * IP')), context)
const secret = 's'.repeat(32)
const request = (headers) => new Request('https://example.com/api/admin/data', { headers })

test('Node environment variables are supported, with context values taking priority', () => {
  assert.equal(context.env({}, 'SESSION_SECRET'), secret)
  assert.equal(context.env({ env: { SESSION_SECRET: 'configured' } }, 'SESSION_SECRET'), 'configured')
})

test('valid sessions work through Bearer headers and HttpOnly cookies', async () => {
  const token = await context.sign({ role: 'admin', exp: Date.now() + 60000 }, secret)
  assert.equal(await context.verify(request({ authorization: 'Bearer ' + token }), secret), true)
  assert.equal(await context.verify(request({ cookie: 'other=1; lg_session=' + token }), secret), true)
})

test('expired, tampered, wrong-key, and missing sessions are rejected', async () => {
  const expired = await context.sign({ role: 'admin', exp: Date.now() - 1 }, secret)
  const valid = await context.sign({ role: 'admin', exp: Date.now() + 60000 }, secret)
  assert.equal(await context.verify(request({ cookie: 'lg_session=' + expired }), secret), false)
  assert.equal(await context.verify(request({ authorization: 'Bearer x' + valid }), secret), false)
  assert.equal(await context.verify(request({ authorization: 'Bearer ' + valid }), 'x'.repeat(32)), false)
  assert.equal(await context.verify(request({}), secret), false)
  assert.equal(await context.verify(request({ authorization: 'Bearer ' + valid }), ''), false)
})

function server() {
  const runtime = vm.createContext({
    crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array, Date,
    URL, Response, Blob, structuredClone, console,
    process: { env: { ADMIN_PASSWORD: 'test-password', SESSION_SECRET: secret } },
    getStore: () => ({ get: async () => null }),
  })
  vm.runInContext(source.replace('import { getStore } from "@edgeone/pages-blob"', '').replace('export async function onRequest', 'async function onRequest').replace('export default onRequest', ''), runtime)
  return runtime
}

test('login, cookie-based reload, logout, and missing configuration return correct responses', async () => {
  const runtime = server()
  const login = await runtime.onRequest({ request: new Request('https://example.com/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) }) })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly; SameSite=Strict/)
  assert.match(cookie, /; Secure/)
  const loggedIn = await runtime.onRequest({ request: request({ cookie: cookie.split(';')[0] }) })
  assert.equal(loggedIn.status, 200)
  assert.equal(typeof (await loggedIn.json()).site.title, 'string')
  const logout = await runtime.onRequest({ request: new Request('https://example.com/api/logout', { method: 'POST' }) })
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  const signedOut = await runtime.onRequest({ request: request({}) })
  assert.equal(signedOut.status, 401)
  runtime.process.env.SESSION_SECRET = ''
  const misconfigured = await runtime.onRequest({ request: request({}) })
  assert.equal(misconfigured.status, 503)
  assert.match((await misconfigured.json()).error, /安全配置/)
})
