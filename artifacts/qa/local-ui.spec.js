const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')

test.use({ channel: 'chrome' })

const root = path.resolve(__dirname)
const evidence = []

function observe(page, label) {
  const record = { label, consoleErrors: [], failedRequests: [], errorResponses: [] }
  evidence.push(record)
  page.on('console', (message) => {
    if (message.type() === 'error') record.consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    record.failedRequests.push({ url: request.url(), error: request.failure()?.errorText })
  })
  page.on('response', (response) => {
    if (response.status() >= 400) record.errorResponses.push({ url: response.url(), status: response.status() })
  })
  return record
}

async function layoutMetrics(page) {
  return page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
  }))
}

async function screenshot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(root, `${name}.png`), fullPage })
}

test.afterAll(() => {
  fs.writeFileSync(path.join(root, 'browser-evidence.json'), JSON.stringify(evidence, null, 2))
})

test('landing loads and booking validates/submits against local mock', async ({ page }) => {
  observe(page, 'landing-functional')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('http://127.0.0.1:5180', { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.getByText('iGourmet Test', { exact: true }).first()).toBeVisible()
  await page.locator('#dat-ban').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Xác nhận đặt bàn' }).click()
  await expect(page.getByText(/Vui lòng điền đầy đủ/)).toBeVisible()
  const selects = page.locator('#dat-ban select')
  await selects.nth(0).selectOption('1')
  await expect(selects.nth(1).locator('option')).toHaveCount(3)
  await selects.nth(1).selectOption('11')
  const inputs = page.locator('#dat-ban input')
  await inputs.nth(0).fill('Nguyễn Văn QA')
  await inputs.nth(1).fill('0900000000')
  await inputs.nth(2).fill('qa@example.test')
  await inputs.nth(3).fill('2026-08-20')
  await inputs.nth(4).fill('19:30')
  await page.getByRole('button', { name: 'Xác nhận đặt bàn' }).click()
  await expect(page.getByText('Đặt bàn thành công!')).toBeVisible()
  await screenshot(page, 'landing-booking-success')
})

test('landing pagination overflow is reproduced at both required mobile widths', async ({ page }) => {
  observe(page, 'landing-mobile-overflow')
  const failures = []
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('http://127.0.0.1:5180', { waitUntil: 'networkidle' })
    await page.locator('#thuc-don').scrollIntoViewIfNeeded()
    const metrics = await layoutMetrics(page)
    if (metrics.documentWidth > metrics.viewportWidth) failures.push({ viewport, metrics })
    await screenshot(page, `landing-${viewport.width}x${viewport.height}`, false)
  }
  expect(failures, JSON.stringify(failures)).toEqual([])
})

test('landing tablet laptop desktop have no document overflow', async ({ page }) => {
  observe(page, 'landing-large-viewports')
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await page.goto('http://127.0.0.1:5180', { waitUntil: 'networkidle' })
    const metrics = await layoutMetrics(page)
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)
    await screenshot(page, `landing-${viewport.width}x${viewport.height}`, false)
  }
})

test('customer public pages and login work with local mock', async ({ page }) => {
  observe(page, 'customer-public-login')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:5181/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page.getByText('Vui lòng nhập email và mật khẩu')).toBeVisible()
  await page.locator('input[type="email"]').fill('qa@example.test')
  await page.locator('input[type="password"]').fill('valid-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:5181/')
  await expect(page.getByText('Đăng nhập')).toHaveCount(0)
  await screenshot(page, 'customer-home-authenticated-mobile', false)
})

test('customer guest reservation history infinite loader reproduces twice', async ({ page }) => {
  observe(page, 'customer-history-guest')
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(`http://127.0.0.1:5181/booking/history?attempt=${attempt}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
    await expect(page.getByText('Đang tải lịch sử đặt bàn...')).toBeVisible()
  }
  await screenshot(page, 'customer-history-guest-loader', false)
})

test('customer unknown routes reproduce missing 404 twice', async ({ page }) => {
  observe(page, 'customer-missing-404')
  for (const route of ['/does-not-exist', '/booking/unknown']) {
    await page.goto(`http://127.0.0.1:5181${route}`, { waitUntil: 'networkidle' })
    await expect(page.getByText(/404|không tìm thấy/i)).toHaveCount(0)
  }
  await screenshot(page, 'customer-missing-404', false)
})

async function loginInternal(page, username) {
  await page.goto('http://127.0.0.1:5182/login', { waitUntil: 'networkidle' })
  await page.locator('input[type="text"]').fill(username)
  await page.locator('input[type="password"]').fill('valid-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.waitForLoadState('networkidle')
}

test('internal role landing pages render for all operational roles', async ({ browser }) => {
  const roles = [
    ['cashier.qa', '/tables'],
    ['waiter.qa', '/orders'],
    ['kitchen.qa', '/kitchen'],
    ['reception.qa', '/floor'],
    ['admin.qa', '/'],
  ]
  for (const [username, expectedPath] of roles) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    observe(page, `internal-${username}`)
    await loginInternal(page, username)
    await expect(page).toHaveURL(new RegExp(`${expectedPath === '/' ? '/$' : expectedPath}`))
    await expect(page.locator('body')).not.toBeEmpty()
    await screenshot(page, `internal-${username.split('.')[0]}-1366x768`, false)
    await page.close()
  }
})

test('cashier page responsive matrix and unknown route behavior', async ({ page }) => {
  observe(page, 'internal-cashier-responsive')
  await loginInternal(page, 'cashier.qa')
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    const metrics = await layoutMetrics(page)
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)
    await screenshot(page, `internal-cashier-${viewport.width}x${viewport.height}`, false)
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.evaluate((pathName) => {
      window.history.pushState({}, '', pathName)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, `/not-found-${attempt}`)
    await expect(page).toHaveURL(/\/tables$/)
  }
})
