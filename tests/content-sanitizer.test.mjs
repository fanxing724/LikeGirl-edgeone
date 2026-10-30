import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const source = await readFile(new URL('../app/common.js', import.meta.url), 'utf8')

function sanitize(html) {
  const dom = new JSDOM('', { runScripts: 'outside-only' })
  try {
    // Keep page boot dormant while exercising the public sanitizer.
    dom.window.document.addEventListener = () => {}
    dom.window.eval(source)
    const output = dom.window.LG.sanitizeHTML(html)
    const fragment = dom.window.document.createElement('div')
    fragment.innerHTML = output
    return fragment
  } finally {
    dom.window.close()
  }
}

test('cleans descendants before unwrapping unsupported tags', () => {
  const output = sanitize('<section><aside><img src="https://example.com/a.png" onerror="alert(1)"><a href="javascript:alert(1)">text</a></aside></section>')
  assert.equal(output.querySelector('section, aside'), null)
  assert.equal(output.querySelector('img').hasAttribute('onerror'), false)
  assert.equal(output.querySelector('a').hasAttribute('href'), false)
  assert.equal(output.textContent, 'text')
})

test('rejects executable and embedded URL schemes including encoded whitespace', () => {
  for (const url of ['javascript:alert(1)', 'java&#x09;script:alert(1)', 'java&#x0a;script:alert(1)', 'data:text/html,test', 'vbscript:msgbox(1)']) {
    const output = sanitize(`<a href="${url}">link</a><img src="${url}">`)
    assert.equal(output.querySelector('a').hasAttribute('href'), false, url)
    assert.equal(output.querySelector('img').hasAttribute('src'), false, url)
  }
})

test('preserves article formatting, images and ordinary links', () => {
  const output = sanitize('<h2>Title</h2><p><strong>Love</strong><a href="/page.html?id=1">story</a><a href="mailto:a@example.com">email</a><img src="https://example.com/photo.jpg" alt="photo"></p>')
  assert.equal(output.querySelector('h2').textContent, 'Title')
  assert.equal(output.querySelector('strong').textContent, 'Love')
  assert.equal(output.querySelector('a').getAttribute('href'), '/page.html?id=1')
  assert.equal(output.querySelectorAll('a')[1].getAttribute('href'), 'mailto:a@example.com')
  assert.equal(output.querySelector('img').getAttribute('src'), 'https://example.com/photo.jpg')
})
