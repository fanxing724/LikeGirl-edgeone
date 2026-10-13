import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createRepository } from '../node-functions/_lib/repository.js'
import { createHandler } from '../node-functions/[[default]].js'
import { sign } from '../node-functions/_lib/auth.js'

const source = await readFile(new URL('../app/admin-session.js', import.meta.url), 'utf8')

function client(fetch, initialToken = '', blockedStorage = false) {
  const saved = new Map(initialToken ? [['lg_token', initialToken]] : [])
  const context = { window: {}, Headers, fetch, sessionStorage: {
    getItem(key) { if (blockedStorage) throw new Error('blocked'); return saved.get(key) },
    setItem(key, value) { if (blockedStorage) throw new Error('blocked'); saved.set(key, value) },
    removeItem(key) { if (blockedStorage) throw new Error('blocked'); saved.delete(key) },
  } }
  vm.runInNewContext(source, context)
  return { session: context.window.LGAdminSession, saved }
}

async function server() {
  const values = new Map()
  const db = { get: async key => values.get(key) ?? null, setJSON: async (key, value) => values.set(key, value) }
  const handler = createHandler(createRepository(() => db))
  await handler({ request: new Request('https://example.com/api/setup', { method: 'POST', body: JSON.stringify({ password: 'test-password', confirmPassword: 'test-password' }) }) })
  let cookie = ''
  const calls = []
  const fetch = async (path, options = {}) => {
    const headers = new Headers(options.headers)
    if (cookie) headers.set('cookie', cookie)
    const response = await handler({ request: new Request('https://example.com' + path, { ...options, headers }) })
    calls.push({ path, authorization: headers.get('authorization'), status: response.status })
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
    return response
  }
  const login = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test-password' }) })
  return { fetch, calls, token: (await login.json()).token, secret: values.get('likegirl_admin_auth').secret }
}

test('stale browser token recovers using a valid cookie and clears stored token', async () => {
  const { fetch, calls, secret } = await server()
  const stale = await sign({ role: 'admin', exp: Date.now() - 1 }, secret)
  const { session, saved } = client(fetch, stale)
  assert.equal((await session.request('admin/data')).status, 200)
  assert.deepEqual(calls.slice(-2).map(call => call.status), [401, 200])
  assert.equal(calls.at(-1).authorization, null)
  assert.equal(saved.has('lg_token'), false)
})

test('page reload and image upload use cookie without an empty Bearer header', async () => {
  const { fetch, calls } = await server()
  const { session } = client(fetch)
  assert.equal((await session.request('admin/data')).status, 200)
  const form = new FormData()
  // Missing file returns validation error, proving upload authentication passed.
  assert.equal((await session.request('admin/upload', { method: 'POST', body: form })).status, 400)
  assert.equal(calls.at(-1).authorization, null)
})

test('disabled browser storage still allows in-memory Bearer login', async () => {
  const { token } = await server()
  const calls = []
  const { session } = client(async (_path, options) => {
    calls.push(options)
    return new Response('{}')
  }, '', true)
  session.setToken(token)
  await session.request('admin/data')
  assert.equal(calls[0].headers.get('authorization'), 'Bearer ' + token)
  assert.equal(calls[0].credentials, 'same-origin')
  session.setToken('')
  await session.request('admin/data')
  assert.equal(calls[1].headers.get('authorization'), null)
})

test('invalid sessions retry at most once; server failures do not retry writes', async () => {
  let count = 0
  const { session } = client(async () => { count++; return new Response('{}', { status: 401 }) }, 'expired')
  assert.equal((await session.request('admin/data')).status, 401)
  assert.equal(count, 2)
  await session.request('admin/data')
  assert.equal(count, 3)
  count = 0
  const other = client(async () => { count++; return new Response('{}', { status: 503 }) }, 'valid')
  await other.session.request('admin/data', { method: 'PUT', body: '{}' })
  assert.equal(count, 1)
})
