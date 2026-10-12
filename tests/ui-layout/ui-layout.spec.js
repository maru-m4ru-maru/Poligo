import { test, expect } from '@playwright/test'

async function assertNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }))
  expect(sizes.document, 'page should not extend beyond the viewport horizontally')
    .toBeLessThanOrEqual(sizes.viewport + 1)
}

async function assertFitsHorizontally(page, selectors) {
  const viewport = page.viewportSize()
  for (const selector of selectors) {
    const element = page.locator(selector).first()
    await expect(element, selector + ' should be visible').toBeVisible()
    const rect = await element.boundingBox()
    expect(rect, selector + ' should have measurable bounds').not.toBeNull()
    expect(rect.x, selector + ' should not cross the left viewport edge').toBeGreaterThanOrEqual(-1)
    expect(rect.x + rect.width, selector + ' should not cross the right viewport edge')
      .toBeLessThanOrEqual(viewport.width + 1)
  }
}

async function mockAuthenticatedApi(page) {
  const now = new Date().toISOString()
  const user = {
    id: 'ui-layout-user',
    name: 'Layout Test',
    email: 'layout-test@example.com',
    emailVerified: true,
    isAdmin: false,
    createdAt: now,
    updatedAt: now
  }
  const project = {
    id: 'ui-layout-project',
    name: 'Layout verification',
    description: 'Responsive geometry fixture',
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now(),
    fileCount: 2,
    storageBytes: 512,
    files: {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Poligo layout</h1></body></html>',
      'main.py': 'print("Layout test")'
    }
  }

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    const method = route.request().method()
    const json = body => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })

    if (pathname === '/api/auth/get-session') {
      return json({
        session: {
          id: 'ui-layout-session',
          userId: user.id,
          token: 'ui-layout-token',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          createdAt: now,
          updatedAt: now
        },
        user
      })
    }

    if (pathname === '/api/workspace/claim') {
      return json({ claimed: true })
    }

    if (pathname === '/api/dashboard') {
      return json({
        user,
        projects: [project],
        stats: {
          projectCount: 1,
          storageBytes: 512,
          storageLimitBytes: 15 * 1024 * 1024
        }
      })
    }

    if (pathname === '/api/projects') {
      return json(method === 'GET' ? [project] : project)
    }

    if (pathname.startsWith('/api/projects/')) {
      if (pathname.endsWith('/commits')) return json([])
      if (pathname.includes('/commits/')) return json({ commits: [], diff: [] })
      return method === 'DELETE' ? route.fulfill({ status: 204, body: '' }) : json(project)
    }

    if (pathname === '/api/announcements') return json([])

    return json({})
  })
}

test('homepage positions and spacing hold at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await expect(page.locator('.home-hero')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.home-nav', '.home-nav-actions', '.home-hero', '.home-hero-actions',
    '.home-feature-strip', '.home-language-section', '.home-footer'
  ])

  const brand = await page.locator('.home-brand').boundingBox()
  const firstAction = await page.locator('.home-nav-actions button').first().boundingBox()
  expect(brand.x + brand.width).toBeLessThan(firstAction.x)
})

test('home, terms, and sign-in pages fit common mobile and narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.home-hero')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.home-nav', '.home-nav-actions', '.home-hero', '.home-hero-actions',
    '.home-feature-strip', '.home-language-section', '.home-footer'
  ])

  await page.getByRole('button', { name: '利用規約' }).first().click()
  await expect(page.locator('.terms-grid')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.terms-nav', '.terms-heading', '.terms-grid', '.terms-footer'])

  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/signin')
  await expect(page.locator('.auth-page-card')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.auth-page-card', '.auth-page-form', '.auth-page-submit'])
})

test('dashboard and project template dialog stay inside desktop and mobile viewports', async ({ page }) => {
  await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/dashboard')
  await expect(page.locator('.stack-dashboard')).toBeVisible()
  await expect(page.locator('.stack-project-table')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.stack-sidebar', '.stack-dashboard-main', '.stack-dashboard-topbar', '.stack-dashboard-content'
  ])

  const sidebar = await page.locator('.stack-sidebar').boundingBox()
  const main = await page.locator('.stack-dashboard-main').boundingBox()
  expect(main.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 1)

  await page.getByRole('button', { name: /新規プロジェクト/ }).click()
  await expect(page.locator('.stack-new-project-menu')).toBeVisible()
  await assertFitsHorizontally(page, ['.stack-new-project-menu'])

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.locator('.stack-dashboard')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.stack-sidebar', '.stack-dashboard-main', '.stack-dashboard-topbar'])
  await page.getByRole('button', { name: /新規プロジェクト/ }).click()
  await expect(page.locator('.stack-new-project-menu')).toBeVisible()
  await assertFitsHorizontally(page, ['.stack-new-project-menu'])
})

test('IDE panels align at desktop and reflow into non-overlapping rows on mobile', async ({ page }) => {
  await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/ide/ui-layout-project')
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect(page.locator('.activity-bar')).toBeVisible()
  await expect(page.locator('.explorer')).toBeVisible()
  await expect(page.locator('.editor-section')).toBeVisible()
  await expect(page.locator('.preview-section')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.topbar', '.activity-bar', '.explorer', '.main-workspace', '.editor-section', '.preview-section'
  ])

  const activity = await page.locator('.activity-bar').boundingBox()
  const explorer = await page.locator('.explorer').boundingBox()
  const workspace = await page.locator('.main-workspace').boundingBox()
  expect(explorer.x).toBeGreaterThanOrEqual(activity.x + activity.width - 1)
  expect(workspace.x).toBeGreaterThanOrEqual(explorer.x + explorer.width - 1)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.topbar', '.activity-bar', '.explorer', '.main-workspace'])
  const mobileActivity = await page.locator('.activity-bar').boundingBox()
  const mobileExplorer = await page.locator('.explorer').boundingBox()
  const mobileWorkspace = await page.locator('.main-workspace').boundingBox()
  expect(mobileExplorer.y).toBeGreaterThanOrEqual(mobileActivity.y + mobileActivity.height - 1)
  expect(mobileWorkspace.y).toBeGreaterThanOrEqual(mobileExplorer.y + mobileExplorer.height - 1)
})
