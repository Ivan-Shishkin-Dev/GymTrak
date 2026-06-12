// Repeatable screenshot loop — drives system Chrome over the DevTools protocol
// (real-time waits, so IndexedDB seeding completes before capture) and writes a
// mobile-viewport PNG per route. No npm deps: uses Node's global fetch +
// WebSocket (Node ≥ 21).
//
//   node scripts/shot.mjs            # screenshots / by default
//   node scripts/shot.mjs / /history /progress /library /log
//   SHOT_W=390 SHOT_H=844 SHOT_WAIT=2200 node scripts/shot.mjs /
//
// Output: .shots/<slug>.png. Dev server URL from $URL (default :5180).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.URL || 'http://localhost:5180'
const W = Number(process.env.SHOT_W || 390)
const H = Number(process.env.SHOT_H || 844)
const WAIT = Number(process.env.SHOT_WAIT || 2200)
const PORT = Number(process.env.SHOT_PORT || 9333)
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/']

const outDir = resolve('.shots')
mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const slugify = (p) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '_'))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${resolve(tmpdir(), 'gymtrak-shot-profile')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

async function cdpTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${BASE}/`, {
        method: 'PUT',
      })
      if (res.ok) return res.json()
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('Chrome DevTools endpoint never came up')
}

/** Minimal CDP client over one target's websocket. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()
  const waiters = []
  let id = 0
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result)
      pending.delete(msg.id)
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].method === msg.method) {
          waiters[i].resolve(msg.params)
          waiters.splice(i, 1)
        }
      }
    }
  })
  const ready = new Promise((r) => ws.addEventListener('open', r))
  const send = (method, params = {}) =>
    new Promise((r) => {
      const mid = ++id
      pending.set(mid, r)
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  const once = (method, timeout = 8000) =>
    Promise.race([
      new Promise((resolve) => waiters.push({ method, resolve })),
      sleep(timeout),
    ])
  return { ready, send, once, close: () => ws.close() }
}

try {
  const target = await cdpTarget()
  const cdp = connect(target.webSocketDebuggerUrl)
  await cdp.ready
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 2,
    mobile: true,
  })
  const evaluate = (expression) =>
    cdp.send('Runtime.evaluate', { expression, awaitPromise: true })

  const capture = async (path) => {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    const out = resolve(outDir, `${slugify(path)}.png`)
    writeFileSync(out, Buffer.from(data, 'base64'))
    console.log(out)
  }

  for (const path of paths) {
    if (path === '/log') {
      // /log needs an open session: start one from Home, then tick a set so the
      // rest timer + Finish button are visible.
      await cdp.send('Page.navigate', { url: `${BASE}/` })
      await cdp.once('Page.loadEventFired')
      await sleep(WAIT)
      await evaluate(
        `document.querySelector('[aria-label="Start today\\'s workout"]')?.click()`,
      )
      await sleep(1200)
      await evaluate(
        `[...document.querySelectorAll('div')].find(d => d.textContent.trim().startsWith('Set 1') && d.children.length >= 4)?.click()`,
      )
      await sleep(700)
      await capture(path)
    } else {
      await cdp.send('Page.navigate', { url: `${BASE}${path}` })
      await cdp.once('Page.loadEventFired')
      await sleep(WAIT) // real time → seed + live queries settle
      await capture(path)
    }
  }
  cdp.close()
} finally {
  chrome.kill()
}
