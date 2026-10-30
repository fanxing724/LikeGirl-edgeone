import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { createHandler } from '../node-functions/[[default]].js'
import { createRepository } from '../node-functions/_lib/repository.js'
import { defaults } from '../node-functions/_lib/defaults.js'
import { createAuthRecord, sign } from '../node-functions/_lib/auth.js'

test('removed management features reject writes while content saves preserve historical records', async () => {
  const auth = await createAuthRecord('test-password')
  const historical = { ...structuredClone(defaults), blockedIps: [{ ip: '127.0.0.1', note: 'history' }], accessWarnings: [{ path: '/old.php' }] }
  const records = new Map([['likegirl_site_data', historical], ['likegirl_admin_auth', auth]])
  let writes = 0
  const handler = createHandler(createRepository(() => ({
    get: async key => records.get(key) ?? null,
    setJSON: async (key, value) => { writes++; records.set(key, value) },
    set: async (key, value) => records.set(key, value),
  })))
  const token = await sign({ role: 'admin', exp: Date.now() + 60000 }, auth.secret)
  const save = patch => handler({ request: new Request('https://example.com/api/admin/data', {
    method: 'PUT', headers: { 'x-lg-session': token }, body: JSON.stringify(patch),
  }) })
  for (const patch of [{ blockedIps: [] }, { accessWarnings: [] }]) {
    const response = await save(patch)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'UNSUPPORTED_FEATURE')
  }
  assert.equal(writes, 0)
  assert.equal((await save({ site: { title: 'updated' } })).status, 200)
  const saved = records.get('likegirl_site_data')
  assert.deepEqual(saved.blockedIps, historical.blockedIps)
  assert.deepEqual(saved.accessWarnings, historical.accessWarnings)
  assert.equal(saved.site.title, 'updated')
  // The retired blacklist no longer denies messages; rate limiting remains.
  const post = () => handler({ clientIp: '127.0.0.1', request: new Request('https://example.com/api/messages', {
    method: 'POST', body: JSON.stringify({ name: 'visitor', text: 'hello' }),
  }) })
  assert.equal((await post()).status, 201)
  assert.equal((await post()).status, 429)
})

test('admin navigation contains supported features only and old hashes fall back safely', async () => {
  const [jquery, source] = await Promise.all([
    readFile(new URL('../Style/jquery/jquery.min.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin.js', import.meta.url), 'utf8'),
  ])
  for (const hash of ['ips', 'warnings', 'settings']) {
    const dom = new JSDOM('<div id="lg-admin"></div>', { url: 'https://example.com/admin.html#' + hash, runScripts: 'outside-only' })
    try {
      const { window } = dom
      window.eval(jquery)
      window.LGAdminSession = {
        request: async path => new Response(JSON.stringify(path === 'setup/status' ? { initialized: true } : defaults)),
      }
      window.eval(source)
      for (let i = 0; i < 50 && !window.document.querySelector('#lg-content .card'); i++) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      const doc = window.document
      assert.ok(doc.querySelector('#lg-content .card'))
      assert.equal(doc.querySelector('a[href="#ips"], a[href="#warnings"], #f-ip, #clear-warn'), null)
      for (const route of ['settings', 'messages', 'stories', 'photos', 'wishes', 'about']) {
        assert.ok(doc.querySelector(`a[href="#${route}"]`), route)
      }
      if (hash === 'settings') assert.ok(doc.querySelector('[name="pjax"]'))
      else assert.match(doc.querySelector('.side-nav-link.active').getAttribute('href'), /dashboard/)
    } finally { dom.window.close() }
  }
})
