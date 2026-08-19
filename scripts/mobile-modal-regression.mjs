import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean)

const browserPath = browserCandidates.find((candidate) => existsSync(candidate))
assert(browserPath, '没有找到可用于回归测试的 Edge 或 Chrome')

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert(address && typeof address === 'object')
      server.close(() => resolve(address.port))
    })
  })
}

async function waitForValue(read, timeoutMs = 10_000) {
  const startedAt = Date.now()
  let lastError
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await read()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw lastError ?? new Error(`等待 ${timeoutMs}ms 后仍未满足条件`)
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url)
    this.nextId = 1
    this.pending = new Map()
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket.close()
  }
}

const port = await getFreePort()
const profileDirectory = mkdtempSync(join(tmpdir(), 'qqj-lover-browser-'))
const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDirectory}`,
  baseUrl,
], { stdio: 'ignore', windowsHide: true })

let client
try {
  const target = await waitForValue(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`)
    const targets = await response.json()
    return targets.find((candidate) => candidate.type === 'page' && candidate.url.startsWith(baseUrl))
  })

  client = new CdpClient(target.webSocketDebuggerUrl)
  await client.connect()
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

  const evaluate = async (expression) => {
    const result = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }

  await waitForValue(() => evaluate(`document.readyState === 'complete' && location.origin === new URL('${baseUrl}').origin`))
  await evaluate(`localStorage.setItem('future-with-you.app-state.v2', JSON.stringify({ version: 2, hasOpened: true }))`)
  await client.send('Page.reload')
  await waitForValue(() => evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('.bottom-nav'))`))

  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('.bottom-nav button')].find((item) => item.textContent.includes('我们'))
    button?.click()
    return Boolean(button)
  })()`), '没有找到“我们”导航按钮')
  await waitForValue(() => evaluate(`Boolean([...document.querySelectorAll('button')].find((item) => item.textContent.includes('编辑我们的资料')))`))
  await evaluate(`(() => {
    const originalCreateObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => { window.__capturedBackupBlob = blob; return originalCreateObjectURL(blob) }
    const originalAnchorClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () { window.__capturedBackupFileName = this.download; return originalAnchorClick.call(this) }
  })()`)
  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('下载完整备份'))
    button?.scrollIntoView({ block: 'center' })
    return Boolean(button)
  })()`), '没有找到“下载完整备份”按钮')
  await new Promise((resolve) => setTimeout(resolve, 300))
  const backupButton = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('下载完整备份'))
    const rect = button?.getBoundingClientRect()
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
  })()`)
  assert(backupButton, '无法取得“下载完整备份”按钮位置')
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: backupButton.x, y: backupButton.y })
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: backupButton.x, y: backupButton.y, button: 'left', clickCount: 1 })
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: backupButton.x, y: backupButton.y, button: 'left', clickCount: 1 })
  await waitForValue(() => evaluate(`Boolean(window.__capturedBackupBlob && window.__capturedBackupFileName)`))
  const capturedBackup = await evaluate(`(async () => ({
    fileName: window.__capturedBackupFileName,
    mimeType: window.__capturedBackupBlob.type,
    payload: await window.__capturedBackupBlob.text(),
  }))()`)
  const backupFileName = capturedBackup.fileName
  const backup = JSON.parse(capturedBackup.payload)
  const downloadDiagnostics = await evaluate(`({ toast: document.querySelector('.toast')?.textContent, lastBackupAt: localStorage.getItem('future-with-you.last-backup-at'), hasSubtleCrypto: Boolean(crypto?.subtle) })`)
  assert(downloadDiagnostics.lastBackupAt, '导出成功后没有记录上次备份时间')
  assert.match(backupFileName, /^future-with-you-full-backup-.+\.json$/, '下载文件名不正确')
  assert.equal(capturedBackup.mimeType, 'application/json', '下载文件 MIME 类型不正确')
  assert.equal(backup.format, 'future-with-you.full-backup', '下载文件缺少完整备份格式标识')
  assert.equal(backup.formatVersion, 1, '下载文件备份格式版本不正确')
  assert.equal(backup.state.version, 2, '下载文件没有包含完整应用状态')
  assert.equal(backup.integrity.algorithm, 'SHA-256', '下载文件缺少完整性算法')
  const expectedChecksum = createHash('sha256').update(JSON.stringify(backup.state)).digest('hex')
  assert.equal(backup.integrity.value, expectedChecksum, '下载文件的 SHA-256 校验值不正确')
  console.log(JSON.stringify({
    backupFileName,
    backupFormat: backup.format,
    backupFormatVersion: backup.formatVersion,
    backupStateVersion: backup.state.version,
    backupChecksumVerified: true,
  }, null, 2))
  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('编辑我们的资料'))
    button?.click()
    return Boolean(button)
  })()`), '没有找到“编辑我们的资料”按钮')
  await waitForValue(() => evaluate(`Boolean(document.querySelector('[role="dialog"]'))`))

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 430,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await new Promise((resolve) => setTimeout(resolve, 500))

  const report = await evaluate(`(() => {
    const overlay = document.querySelector('.modal-overlay')
    const dialog = document.querySelector('[role="dialog"]')
    const body = dialog?.querySelector('.modal-card__body')
    const firstInput = dialog?.querySelector('input')
    const submit = dialog?.querySelector('button[type="submit"]')
    firstInput?.focus()
    if (body) body.scrollTop = body.scrollHeight
    const dialogRect = dialog?.getBoundingClientRect()
    const submitRect = submit?.getBoundingClientRect()
    const clippingAncestors = []
    let ancestor = overlay?.parentElement
    while (ancestor && ancestor !== document.body) {
      const style = getComputedStyle(ancestor)
      if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflow) ||
          ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY)) {
        clippingAncestors.push({ className: ancestor.className, overflow: style.overflow, overflowY: style.overflowY })
      }
      ancestor = ancestor.parentElement
    }
    return {
      viewportHeight: visualViewport?.height ?? innerHeight,
      overlayIsBodyChild: overlay?.parentElement === document.body,
      clippingAncestors,
      dialogTop: dialogRect?.top,
      dialogBottom: dialogRect?.bottom,
      bodyClientHeight: body?.clientHeight,
      bodyScrollHeight: body?.scrollHeight,
      bodyScrollTop: body?.scrollTop,
      submitTop: submitRect?.top,
      submitBottom: submitRect?.bottom,
      activeElement: document.activeElement?.tagName,
    }
  })()`)

  console.log(JSON.stringify(report, null, 2))
  assert.equal(report.overlayIsBodyChild, true, '弹窗仍位于会裁切内容的应用外壳内')
  assert.equal(report.clippingAncestors.length, 0, '弹窗仍有会裁切内容的祖先容器')
  assert(report.dialogTop >= 0, '弹窗顶部超出了手机可视区')
  assert(report.dialogBottom <= report.viewportHeight + 1, '弹窗底部超出了手机可视区')
  assert(report.bodyScrollHeight >= report.bodyClientHeight, '弹窗内容区没有形成可控滚动区域')
  assert(report.submitTop >= 0 && report.submitBottom <= report.viewportHeight + 1, '滚动后提交按钮仍不可见')
  assert.equal(report.activeElement, 'INPUT', '打开弹窗后没有正确聚焦首个输入框')
  console.log('mobile-modal-regression: PASS')
} finally {
  client?.close()
  browser.kill()
  await Promise.race([
    once(browser, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (profileDirectory.startsWith(tmpdir())) {
    try {
      rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch {
      console.warn(`测试浏览器临时目录稍后由系统清理：${profileDirectory}`)
    }
  }
}
