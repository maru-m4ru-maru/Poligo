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
  const apiRequests = []
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
      'main.py': 'print("Layout test")',
      'style.css': 'body { margin: 0; }',
      'script.js': 'console.log("Poligo")',
      'index.ts': 'const label: string = "Poligo"',
      'Program.cs': 'Console.WriteLine("Poligo")',
      'main.cpp': '#include <iostream>'
    }
  }

  const communityProject = {
    id: 'ui-layout-community-project',
    name: 'Community card layout',
    description: 'A sample shared project for responsive checks.',
    language: 'Python',
    published_at: now,
    stars: 2,
    forks: 1,
    featured: true,
    starred: false,
    favorited: false,
    files: {
      'main.py': 'print("Community layout")',
      'src/utils.py': 'def greet():\\n    return "Nested source test"'
    }
  }

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    const method = route.request().method()
    apiRequests.push({ method, pathname })
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

    if (pathname === '/api/community/projects' && url.searchParams.has('sourceProjectId')) {
      return json({ projects: [] })
    }
    if (pathname === '/api/community/projects' && method === 'POST') {
      return json({
        project: {
          id: 'ui-layout-community-project',
          source_project_id: 'ui-layout-project',
          owner_id: user.id,
          name: 'Published layout project',
          description: 'Sharing from the IDE test.',
          language: 'Python',
          stars: 0,
          forks: 0
        }
      })
    }
    if (pathname === '/api/community/projects') return json({ projects: [communityProject] })
    if (pathname === '/api/community/featured') return json({ projects: [communityProject] })
    if (pathname === '/api/community/projects/ui-layout-community-project' && method === 'GET') {
      return json({
        project: communityProject,
        comments: [{
          id: 'ui-layout-comment',
          authorId: 'ui-layout-reviewer',
          body: 'The project detail page is easy to read.',
          createdAt: now,
          own: false
        }]
      })
    }
    if (pathname === '/api/community/projects/ui-layout-community-project/comments' && method === 'POST') {
      return json({
        comment: {
          id: 'ui-layout-comment-new',
          authorId: user.id,
          body: JSON.parse(route.request().postData() || '{}').body,
          createdAt: now,
          own: true
        }
      })
    }
    if (pathname === '/api/community/projects/ui-layout-community-project/star' && method === 'POST') {
      return json({ active: true })
    }
    if (pathname === '/api/community/projects/ui-layout-community-project/favorite' && method === 'POST') {
      return json({ active: true })
    }

    if (pathname === '/api/announcements') return json([])

    return json({})
  })

  return { apiRequests }
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
  await expect(page.locator('.home-brand img')).toHaveAttribute('src', '/poligo-logo.svg')
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

  await page.locator('.terms-nav').getByRole('button', { name: 'プライバシーポリシー' }).click()
  await expect(page.getByRole('heading', { name: 'プライバシーポリシー' })).toBeVisible()
  await expect(page.locator('.legal-grid')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.terms-nav', '.terms-heading', '.legal-grid', '.terms-footer'])

  await page.setViewportSize({ width: 320, height: 740 })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'プライバシーポリシー' })).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.terms-nav', '.terms-heading', '.legal-grid', '.terms-footer'])
  await page.goto('/signin')
  await expect(page.locator('.auth-page-card')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.auth-page-card', '.auth-page-form', '.auth-page-submit'])

  await page.goto('/createaccount')
  await expect(page.locator('.auth-page-card')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: '利用規約に同意します。' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'プライバシーポリシーに同意します。' })).toBeVisible()
  const createAccountButton = page.getByRole('button', { name: 'アカウントを作成', exact: true })
  await expect(createAccountButton).toBeDisabled()
  await expect(page.getByRole('link', { name: '読む' }).nth(0)).toHaveAttribute('href', '/terms')
  await expect(page.getByRole('link', { name: '読む' }).nth(1)).toHaveAttribute('href', '/privacy')

  await page.getByRole('checkbox', { name: '利用規約に同意します。' }).check()
  await expect(createAccountButton).toBeDisabled()
  await page.getByRole('checkbox', { name: 'プライバシーポリシーに同意します。' }).check()
  await expect(createAccountButton).toBeEnabled()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, ['.auth-page-card', '.auth-page-form', '.auth-page-consent-group', '.auth-page-submit'])
})

test('dashboard and project template dialog stay inside desktop and mobile viewports', async ({ page }) => {
  await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/dashboard')
  await expect(page.locator('.stack-dashboard')).toBeVisible()
  await expect(page.locator('.stack-project-table')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  const brandLogo = page.locator('.stack-sidebar-brand img')
  await expect(brandLogo).toHaveAttribute('src', '/poligo-logo.svg')
  const brandLogoBounds = await brandLogo.boundingBox()
  expect(brandLogoBounds.width).toBeGreaterThanOrEqual(110)

  await expect(page.locator('.stack-project-table-head > span')).toHaveCount(6)
  const projectRow = page.locator('.stack-project-list-row').first()
  await expect(projectRow.locator(':scope > *')).toHaveCount(6)
  const checkboxBounds = await projectRow.locator('.stack-project-check').boundingBox()
  const menuBounds = await projectRow.locator('.stack-project-menu-button').boundingBox()
  expect(Math.abs(
    checkboxBounds.y + checkboxBounds.height / 2 - menuBounds.y - menuBounds.height / 2
  )).toBeLessThan(8)
  const iconBounds = await projectRow.locator('.stack-project-project-icon').boundingBox()
  const titleBounds = await projectRow.locator('.stack-project-title-copy').boundingBox()
  expect(titleBounds.x).toBeGreaterThanOrEqual(iconBounds.x + iconBounds.width + 8)
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
  const mobileProjectRow = page.locator('.stack-project-list-row').first()
  await expect(mobileProjectRow.locator('.stack-project-list-title strong')).toBeVisible()
  const mobileCheckbox = await mobileProjectRow.locator('.stack-project-check').boundingBox()
  const mobileMenu = await mobileProjectRow.locator('.stack-project-menu-button').boundingBox()
  expect(Math.abs(
    mobileCheckbox.y + mobileCheckbox.height / 2 - mobileMenu.y - mobileMenu.height / 2
  )).toBeLessThan(8)
  await page.getByRole('button', { name: /新規プロジェクト/ }).click()
  await expect(page.locator('.stack-new-project-menu')).toBeVisible()
  await assertFitsHorizontally(page, ['.stack-new-project-menu'])
})

test('IDE panels align at desktop and reflow into non-overlapping rows on mobile', async ({ page }) => {
  const fixture = await mockAuthenticatedApi(page)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/ide/ui-layout-project')
  try {
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 12_000 })
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '')
    throw new Error([
      'IDE failed to mount after mocked authentication and project load.',
      'URL: ' + page.url(),
      'Body: ' + body.slice(0, 1800),
      'API requests: ' + JSON.stringify(fixture.apiRequests),
      'Page errors: ' + JSON.stringify(pageErrors),
      'Original failure: ' + error.message
    ].join('\\n'))
  }
  await expect(page.locator('.activity-bar')).toBeVisible()
  await expect(page.locator('.explorer')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="/icons/html5.svg"]')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="/icons/python.svg"]')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="/icons/css.svg"]')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="/icons/javascript.svg"]')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="/icons/typescript.svg"]')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png"]')).toBeVisible()
  await expect(page.locator('.explorer-file-main img[src="/icons/cplusplus.svg"]')).toBeVisible()
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


test('IDE shares and unpublishes the current project without leaving the editor', async ({ page }) => {
  await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/ide/ui-layout-project')
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 12_000 })

  await page.getByRole('button', { name: 'コミュニティへの共有設定' }).click()
  await expect(page.getByRole('dialog', { name: 'コミュニティへの共有' })).toBeVisible()
  await expect(page.getByLabel('コミュニティでの表示名')).toHaveValue('Layout verification')
  await page.getByLabel('コミュニティでの表示名').fill('Published layout project')
  await page.getByLabel(/説明/).fill('Sharing from the IDE test.')
  await page.getByRole('button', { name: 'コミュニティに公開' }).click()
  await expect(page.getByRole('status')).toContainText('コミュニティに公開しました')
  await expect(page.locator('.project-visibility')).toHaveText('公開中')

  await page.getByRole('button', { name: '非公開にする' }).click()
  await expect(page.getByRole('status')).toContainText('コミュニティから非公開にしました')
  await expect(page.locator('.project-visibility')).toHaveText('非公開')
})


test('community navigation uses plain buttons and notifications work', async ({ page }) => {
  const fixture = await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/community')

  await expect(page.getByRole('heading', { name: 'おすすめ', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'おすすめ', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新着', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '人気', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'すべて', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'お気に入り', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '共有した作品', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'チーム', exact: true })).toHaveCount(0)
  await expect(page.locator('.community-intro, .community-spotlight, .community-editors-desk')).toHaveCount(0)
  await expect(page.locator('.community-project-row')).toHaveCount(1)

  await page.getByRole('button', { name: '通知', exact: true }).click()
  await expect(page.getByRole('heading', { name: '通知', exact: true })).toBeVisible()
  await expect(page.getByText('新しい通知はありません')).toBeVisible()
  expect(fixture.apiRequests.some(request => /\/api\/community\/(teams|invites|invitation-code)/.test(request.pathname))).toBe(false)
  await assertNoHorizontalOverflow(page)
})


test('community feed is fetched on demand and the footer stays fixed', async ({ page }) => {
  const fixture = await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/community')

  await expect(page.getByRole('heading', { name: 'おすすめ', exact: true })).toBeVisible()
  await expect(page.locator('.community-project-row')).toHaveCount(1)
  await expect(page.locator('.community-project-card')).toHaveCount(0)
  await expect(page.locator('.community-spotlight')).toHaveCount(0)
  await expect(page.locator('.community-editors-desk')).toHaveCount(0)

  const background = await page.locator('.community-page').evaluate(element => getComputedStyle(element).backgroundColor)
  expect(background).toBe('rgb(255, 255, 255)')
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.community-header', '.community-header-search', '.community-nav',
    '.community-main', '.community-projects-toolbar', '.community-project-row', '.community-footer'
  ])

  const footer = page.locator('.community-footer')
  const footerPosition = await footer.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      position: getComputedStyle(element).position,
      bottomGap: window.innerHeight - rect.bottom
    }
  })
  expect(footerPosition.position).toBe('fixed')
  expect(Math.abs(footerPosition.bottomGap)).toBeLessThanOrEqual(1)
  await expect(footer.getByRole('button', { name: 'IDEへ戻る' })).toBeVisible()
  await expect(footer.getByRole('button', { name: '利用規約' })).toBeVisible()
  await expect(footer.getByRole('button', { name: 'プライバシーポリシー' })).toBeVisible()

  const feedRequests = () => fixture.apiRequests.filter(request =>
    request.method === 'GET' &&
    ['/api/community/projects', '/api/community/featured', '/api/community/favorites'].includes(request.pathname)
  )
  expect(feedRequests().length).toBeLessThanOrEqual(2)

  await page.getByRole('button', { name: '新着', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新着', exact: true })).toBeVisible()
  await expect(page.locator('.community-project-row')).toHaveCount(1)
  const afterRecent = fixture.apiRequests.filter(request => request.method === 'GET' && request.pathname === '/api/community/projects').length
  expect(afterRecent).toBe(1)

  await page.getByRole('button', { name: '人気', exact: true }).click()
  await expect(page.getByRole('heading', { name: '人気', exact: true })).toBeVisible()
  await expect(page.locator('.community-project-row')).toHaveCount(1)
  const afterPopular = fixture.apiRequests.filter(request => request.method === 'GET' && request.pathname === '/api/community/projects').length
  expect(afterPopular).toBe(2)

  await page.getByRole('button', { name: '新着', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新着', exact: true })).toBeVisible()
  const afterCachedRecent = fixture.apiRequests.filter(request => request.method === 'GET' && request.pathname === '/api/community/projects').length
  expect(afterCachedRecent).toBe(afterPopular)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.locator('.community-footer')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.community-header', '.community-header-search', '.community-nav',
    '.community-main', '.community-projects-toolbar', '.community-project-row', '.community-footer'
  ])

  await page.setViewportSize({ width: 320, height: 740 })
  await page.reload()
  await expect(page.locator('.community-footer')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.community-header', '.community-header-search', '.community-nav',
    '.community-main', '.community-projects-toolbar', '.community-project-row', '.community-footer'
  ])
})


test('opening a community project uses its own route and page', async ({ page }) => {
  await mockAuthenticatedApi(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/#/community')

  await expect(page.getByRole('heading', { name: 'おすすめ', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Community card layout/ }).click()

  await expect(page).toHaveURL(/#\/community\/project\/ui-layout-community-project$/)
  await expect(page.getByRole('heading', { name: 'Community card layout', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ソースファイル', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'コメント', exact: true })).toBeVisible()
  await expect(page.getByText('main.py', { exact: false })).toBeVisible()
  await expect(page.getByText('The project detail page is easy to read.')).toBeVisible()
  await expect(page.locator('.community-modal')).toHaveCount(0)

  await page.getByRole('button', { name: 'main.py のソースコードを表示' }).click()
  await expect(page).toHaveURL(/#\/community\/project\/ui-layout-community-project\/source\/main\.py$/)
  await expect(page.getByRole('heading', { name: 'main.py', exact: true })).toBeVisible()
  await expect(page.getByText('print("Community layout")', { exact: true })).toBeVisible()
  await expect(page.locator('.community-source-code')).toBeVisible()
  await expect(page.locator('.community-modal')).toHaveCount(0)

  await page.goto('/#/community/project/ui-layout-community-project/source/src%2Futils.py')
  await expect(page).toHaveURL(/source\/src%2Futils\.py$/)
  await expect(page.getByRole('heading', { name: 'utils.py', exact: true })).toBeVisible()
  await expect(page.getByText('return "Nested source test"', { exact: true })).toBeVisible()

  await page.locator('.community-source-page .community-back-button').click()
  await expect(page).toHaveURL(/#\/community\/project\/ui-layout-community-project$/)
  await expect(page.getByRole('heading', { name: 'Community card layout', exact: true })).toBeVisible()
  await expect(page.locator('.community-detail-project')).toBeVisible()
  await expect(page.locator('.community-footer')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.community-header', '.community-detail-main', '.community-detail-project',
    '.community-detail-actions', '.community-detail-files', '.community-detail-comments',
    '.community-footer'
  ])

  await page.locator('.community-project-detail-page .community-back-button').click()
  await expect(page).toHaveURL(/#\/community$/)
  await expect(page.getByRole('heading', { name: 'おすすめ', exact: true })).toBeVisible()

  await page.goto('/#/community/project/ui-layout-community-project')
  await expect(page.getByRole('heading', { name: 'Community card layout', exact: true })).toBeVisible()
  await expect(page.locator('.community-modal')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.locator('.community-detail-project')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.community-header', '.community-detail-main', '.community-detail-project',
    '.community-detail-actions', '.community-detail-files', '.community-detail-comments',
    '.community-footer'
  ])

  await page.setViewportSize({ width: 320, height: 740 })
  await page.reload()
  await expect(page.locator('.community-detail-project')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertFitsHorizontally(page, [
    '.community-header', '.community-detail-main', '.community-detail-project',
    '.community-detail-actions', '.community-detail-files', '.community-detail-comments',
    '.community-footer'
  ])
})


test('community stays focused on project discovery instead of publishing', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    const json = body => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })

    if (pathname === '/api/auth/get-session') return json(null)
    if (pathname === '/api/community/projects' || pathname === '/api/community/featured') {
      return json({ projects: [] })
    }
    if (pathname === '/api/community/notifications') return json({ notifications: [], unreadCount: 0 })
    return json({})
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/community')
  await expect(page.getByRole('heading', { name: 'おすすめ', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'コミュニティを検索' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'おすすめ', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'お気に入り', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'チーム', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /公開/ })).toHaveCount(0)
  await assertNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 320, height: 740 })
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'コミュニティを検索' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'おすすめ', exact: true })).toBeVisible()
  await assertNoHorizontalOverflow(page)
})
