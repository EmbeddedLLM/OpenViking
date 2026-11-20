'use strict'

// The outer shim is trusted, static, and served on a separate site. Caddy
// checks its allowed embedding origin with frame-ancestors.
const studioOrigin = location.hash.slice(1)
const REPORT_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
].join('; ')

function showReport(html) {
  // A template's contents are inert. Remove resource hints and navigations
  // before the HTML is parsed as a live document, without mutating the source.
  const template = document.createElement('template')
  template.innerHTML = html
  for (const element of template.content.querySelectorAll(
    'base,link,meta[http-equiv],script[src],iframe,frame,object,embed',
  )) {
    element.remove()
  }
  for (const link of template.content.querySelectorAll('a[href],area[href]')) {
    if (!link.getAttribute('href').startsWith('#')) link.removeAttribute('href')
    link.removeAttribute('ping')
    link.removeAttribute('target')
  }

  const frame = document.createElement('iframe')
  frame.title = 'Report content'
  frame.sandbox.add('allow-scripts')
  frame.referrerPolicy = 'no-referrer'
  const prefix = '<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer">' +
    '<meta http-equiv="Content-Security-Policy" content="' + REPORT_POLICY + '">'
  const url = URL.createObjectURL(new Blob([prefix, template.innerHTML], { type: 'text/html' }))
  frame.src = url
  frame.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
  document.body.replaceChildren(frame)
}

function receiveReport(event) {
  // The same-origin Studio opener sends the port to this frame in the new tab.
  if (event.origin !== studioOrigin ||
      event.data !== 'openviking-report-preview' || event.ports.length !== 1) return
  window.removeEventListener('message', receiveReport)
  const [channel] = event.ports
  channel.onmessage = (message) => {
    channel.close()
    if (typeof message.data === 'string') showReport(message.data)
  }
  channel.postMessage('openviking-report-ready')
}

if (parent !== window) window.addEventListener('message', receiveReport)
