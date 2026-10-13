import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

// Exercise the real submit handler with form controls and a captured API save.
const source = readFileSync(new URL('../app/admin.js', import.meta.url), 'utf8')
const helpers = source.slice(source.indexOf('  function pick('), source.indexOf('  /* -------------------- 文章'))
const formHelpers = source.slice(source.indexOf('  function formVals('), source.indexOf('  /* -------------------- 登录'))

async function submit(values, keys) {
  let patch
  const context = vm.createContext({
    data: { site: { title: '原站点', logo: '原LOGO', writing: '原文案', blur: true, pjax: true, animation: true, boy: '男主' } },
    save: async (value) => { patch = value },
    notify: () => {}, render: () => {},
  })
  vm.runInContext(formHelpers + helpers, context)
  await context.submitSite({ querySelectorAll: () => Object.entries(values).map(([name, value]) => ({ name, value, type: 'text' })) }, keys)
  return patch.site
}

test('basic settings preserve text and convert only boolean controls', async () => {
  const site = await submit({ title: '我们的纪念站', logo: 'Love', writing: '一直在一起', blur: 'false', pjax: 'true', animation: 'false' }, ['title', 'logo', 'writing', 'blur', 'pjax', 'animation'])
  assert.equal(site.title, '我们的纪念站')
  assert.equal(site.logo, 'Love')
  assert.equal(site.writing, '一直在一起')
  assert.equal(site.blur, false)
  assert.equal(site.pjax, true)
  assert.equal(site.animation, false)
  assert.equal(site.boy, '男主')
})

test('other settings preserve existing boolean options and literal text', async () => {
  const site = await submit({ boy: 'false', girl: 'true' }, ['boy', 'girl'])
  assert.equal(site.boy, 'false')
  assert.equal(site.girl, 'true')
  assert.equal(site.blur, true)
  assert.equal(site.title, '原站点')
})
