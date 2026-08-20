import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const baseOrigin = new URL(baseUrl).origin
const expectCloud = process.argv.includes('--expect-cloud')
const expectCaptcha = process.argv.includes('--expect-captcha')
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
    return targets.find((candidate) => {
      if (candidate.type !== 'page') return false
      try {
        return new URL(candidate.url).origin === baseOrigin
      } catch {
        return false
      }
    })
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

  await waitForValue(() => evaluate(`document.readyState === 'complete' && location.origin === '${baseOrigin}'`))
  const openingVersion = await waitForValue(() => evaluate(`document.querySelector('.opening-letter__topline span:last-child')?.textContent`))
  assert.match(openingVersion, /^V0\.5/, '首屏没有显示当前 V0.5 版本')
  assert.doesNotMatch(openingVersion, /V0\.2/, '首屏仍显示已经过期的 V0.2 版本')
  await evaluate(`localStorage.removeItem('future-with-you.app-state.v3')`)
  await evaluate(`localStorage.setItem('future-with-you.app-state.v2', JSON.stringify({
    version: 2,
    hasOpened: true,
    progress: {
      'wish-001': {
        saved: true,
        completed: true,
        updatedAt: '2025-08-19T12:00:00.000Z',
        completedAt: '2025-08-19',
        note: '我们一起完成了回归测试的晚餐。',
        photoDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      },
    },
  }))`)
  await client.send('Page.reload')
  await waitForValue(() => evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('.bottom-nav'))`))
  if (expectCloud) {
    await waitForValue(() => evaluate(`document.querySelector('[role="dialog"]')?.textContent.includes('回到我们的云端空间')`))
    assert(await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('暂时使用本地模式'))
      button?.click()
      return Boolean(button)
    })()`), '云端 Preview 首次进入时没有提供登录提示或本地模式出口')
    await waitForValue(() => evaluate(`!document.querySelector('[role="dialog"]')`))
    assert.equal(await evaluate(`sessionStorage.getItem('future-with-you.cloud-welcome.dismissed')`), '1', '本地模式选择没有在当前会话记住')
    console.log(JSON.stringify({ cloudWelcomePrompted: true, localModeEscape: true }, null, 2))
  }
  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('.bottom-nav button')].find((item) => item.textContent.includes('故事'))
    button?.click()
    return Boolean(button)
  })()`), '没有找到“故事”导航按钮')
  await waitForValue(() => evaluate(`Boolean(document.querySelector('.story-screen'))`))
  await waitForValue(() => evaluate(`Boolean(localStorage.getItem('future-with-you.app-state.v3'))`))
  const migrationReport = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('future-with-you.app-state.v3'))
    const progress = state.progress['wish-001']
    return {
      stateVersion: state.version,
      memoryCount: state.memories.length,
      linkedWishId: state.memories[0]?.linkedWishId,
      timelineContainsMigratedWish: document.querySelector('.story-timeline')?.textContent.includes('一起做一顿没有菜谱的晚餐'),
      legacyPhotoAndNoteCompacted: !('photoDataUrl' in progress) && !('note' in progress),
    }
  })()`)
  assert.equal(migrationReport.stateVersion, 3, 'V0.3 数据没有迁移到 V0.4 状态')
  assert.equal(migrationReport.memoryCount, 1, '已完成愿望没有迁移为统一回忆')
  assert.equal(migrationReport.linkedWishId, 'wish-001', '迁移后的回忆没有关联原愿望')
  assert.equal(migrationReport.timelineContainsMigratedWish, true, '迁移后的回忆没有显示在时间轴')
  assert.equal(migrationReport.legacyPhotoAndNoteCompacted, true, '迁移后仍重复保存照片或文字')

  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('.story-tabs button')].find((item) => item.textContent.includes('我们的宇宙'))
    button?.click()
    return Boolean(button)
  })()`), '没有找到“我们的宇宙”标签')
  await waitForValue(() => evaluate(`document.querySelectorAll('.memory-star').length === 1`))
  await evaluate(`document.querySelector('.memory-star')?.click()`)
  await waitForValue(() => evaluate(`Boolean(document.querySelector('.memory-detail'))`))
  await evaluate(`document.querySelector('.modal-close')?.click()`)
  await waitForValue(() => evaluate(`!document.querySelector('.memory-detail')`))

  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('.story-tabs button')].find((item) => item.textContent.includes('恋爱博物馆'))
    button?.click()
    return Boolean(button)
  })()`), '没有找到“恋爱博物馆”标签')
  await waitForValue(() => evaluate(`document.querySelectorAll('.museum-exhibit').length === 1`))
  console.log(JSON.stringify({ ...migrationReport, universeStars: 1, museumExhibits: 1 }, null, 2))
  assert(await evaluate(`(() => {
    const button = document.querySelector('.story-heading .round-add-button')
    button?.click()
    return Boolean(button)
  })()`), '没有找到手动添加回忆按钮')
  await waitForValue(() => evaluate(`Boolean(document.querySelector('.memory-form'))`))
  await evaluate(`(() => {
    const form = document.querySelector('.memory-form')
    const setValue = (element, value) => {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setValue(form.querySelector('input[placeholder*="第一次一起看海"]'), '回归测试的珍藏星')
    setValue(form.querySelector('textarea'), '这是一段由真实移动端表单创建的故事。')
    form.querySelector('.memory-feature-toggle input').click()
  })()`)
  await waitForValue(() => evaluate(`!document.querySelector('.memory-form button[type="submit"]').disabled`))
  await evaluate(`document.querySelector('.memory-form button[type="submit"]').click()`)
  await waitForValue(() => evaluate(`JSON.parse(localStorage.getItem('future-with-you.app-state.v3')).memories.length === 2`))
  const manualMemoryReport = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('future-with-you.app-state.v3'))
    const memory = state.memories.find((item) => item.title === '回归测试的珍藏星')
    return { created: Boolean(memory), featured: memory?.featured, kind: memory?.kind }
  })()`)
  assert.equal(manualMemoryReport.created, true, '手动回忆没有保存')
  assert.equal(manualMemoryReport.featured, true, '珍藏展品开关没有保存')
  await waitForValue(() => evaluate(`document.querySelector('.museum-exhibit')?.textContent.includes('回归测试的珍藏星')`))
  console.log(JSON.stringify({ manualMemoryCreated: true, featuredExhibitFirst: true }, null, 2))

  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('.bottom-nav button')].find((item) => item.textContent.includes('我们'))
    button?.click()
    return Boolean(button)
  })()`), '没有找到“我们”导航按钮')
  await waitForValue(() => evaluate(`Boolean([...document.querySelectorAll('button')].find((item) => item.textContent.includes('编辑我们的资料')))`))

  if (expectCloud) {
    assert(await waitForValue(() => evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('登录或创建账号'))
      button?.scrollIntoView({ block: 'center' })
      button?.click()
      return Boolean(button)
    })()`)), '云端模式下没有找到账号入口')
    await waitForValue(() => evaluate(`Boolean(document.querySelector('[role="dialog"]')?.textContent.includes('云端空间'))`))
    assert(await evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')].find((item) => item.textContent.includes('注册'))
      tab?.click()
      return Boolean(tab)
    })()`), '账号弹窗没有注册标签')
    await waitForValue(() => evaluate(`Boolean(document.querySelector('[role="dialog"] input[autocomplete="nickname"]'))`))
    if (expectCaptcha) {
      await waitForValue(
        () => evaluate(`document.querySelector('.cloud-captcha')?.classList.contains('is-verified')`),
        20_000,
      )
      const captchaReport = await evaluate(`(() => {
        const challenge = document.querySelector('.cloud-captcha')
        const submit = document.querySelector('[role="dialog"] button[type="submit"]')
        return {
          widgetMounted: Boolean(challenge?.querySelector('.cloud-captcha__widget')?.firstElementChild),
          verified: challenge?.classList.contains('is-verified'),
          submitEnabled: submit ? !submit.disabled : false,
        }
      })()`)
      console.log(JSON.stringify({ alpha2Captcha: captchaReport }, null, 2))
      assert.equal(captchaReport.widgetMounted, true, 'CAPTCHA 组件没有挂载到账号表单中')
      assert.equal(captchaReport.verified, true, 'CAPTCHA 没有产生可提交的 token')
      assert.equal(captchaReport.submitEnabled, true, 'CAPTCHA 成功后账号按钮仍不可提交')
    }
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 430,
      deviceScaleFactor: 1,
      mobile: true,
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    const cloudModalReport = await evaluate(`(() => {
      const overlay = document.querySelector('.modal-overlay')
      const dialog = document.querySelector('[role="dialog"]')
      const body = dialog?.querySelector('.modal-card__body')
      const submit = dialog?.querySelector('button[type="submit"]')
      const email = dialog?.querySelector('input[type="email"]')
      if (body) body.scrollTop = body.scrollHeight
      const dialogRect = dialog?.getBoundingClientRect()
      const submitRect = submit?.getBoundingClientRect()
      return {
        viewportHeight: visualViewport?.height ?? innerHeight,
        overlayIsBodyChild: overlay?.parentElement === document.body,
        dialogTop: dialogRect?.top,
        dialogBottom: dialogRect?.bottom,
        bodyClientHeight: body?.clientHeight,
        bodyScrollHeight: body?.scrollHeight,
        submitTop: submitRect?.top,
        submitBottom: submitRect?.bottom,
        fieldCount: dialog?.querySelectorAll('.form-field').length,
        inputFontSize: email ? parseFloat(getComputedStyle(email).fontSize) : 0,
      }
    })()`)
    console.log(JSON.stringify({ alpha2CloudModal: cloudModalReport }, null, 2))
    assert.equal(cloudModalReport.overlayIsBodyChild, true, '账号弹窗没有挂载到 body')
    assert.equal(cloudModalReport.fieldCount, 3, '注册表单字段不完整')
    assert(cloudModalReport.dialogTop >= 0, '账号弹窗顶部超出手机可视区')
    assert(cloudModalReport.dialogBottom <= cloudModalReport.viewportHeight + 1, '账号弹窗底部超出手机可视区')
    assert(cloudModalReport.bodyScrollHeight >= cloudModalReport.bodyClientHeight, '账号表单没有可控滚动区域')
    assert(cloudModalReport.submitTop >= 0 && cloudModalReport.submitBottom <= cloudModalReport.viewportHeight + 1, '账号表单提交按钮不可见')
    assert(cloudModalReport.inputFontSize >= 16, '手机输入框字号会触发 iOS 自动缩放')
    await evaluate(`document.querySelector('.modal-close')?.click()`)
    await waitForValue(() => evaluate(`!document.querySelector('[role="dialog"]')`))
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    })
  }

  await evaluate(`(() => {
    const originalCreateObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => { window.__capturedBackupBlob = blob; return originalCreateObjectURL(blob) }
    const originalAnchorClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () { window.__capturedBackupFileName = this.download; return originalAnchorClick.call(this) }
  })()`)
  assert(await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('下载完整备份'))
    button?.scrollIntoView({ block: 'center', behavior: 'instant' })
    return Boolean(button)
  })()`), '没有找到“下载完整备份”按钮')
  await waitForValue(() => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('下载完整备份'))
    const rect = button?.getBoundingClientRect()
    return Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight)
  })()`))
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
  assert.equal(backup.state.version, 3, '下载文件没有包含完整应用状态')
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
