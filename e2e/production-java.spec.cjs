const { test, expect } = require('@playwright/test')

function editor(page) {
  return page.locator('.monaco-editor .inputarea')
}

function fileButton(page, path) {
  return page.locator('.explorer-file[title="' + path + '"] .explorer-file-main')
}

async function setEditorContent(page, source) {
  await editor(page).click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(source)
  await page.waitForTimeout(800)
}

async function createFile(page, path, source) {
  await page.getByRole('button', {
    name: '新しいファイル',
    exact: true
  }).click()

  const input = page.getByRole('textbox', {
    name: '新しいファイル名'
  })

  await input.fill(path)
  await input.press('Enter')
  await expect(fileButton(page, path)).toBeVisible()
  await setEditorContent(page, source)
}

async function openFile(page, path) {
  await fileButton(page, path).click()
  await expect(page.locator('.editor-tab.active')).toContainText(path)
}

async function runAndExpect(page, expectedOutput, options = {}) {
  const args = options.args ?? ''

  const argsInput = page.getByRole('textbox', {
    name: '実行引数'
  })

  await argsInput.fill(args)
  await page.getByRole('button', {
    name: '実行',
    exact: true
  }).click()

  await expect(page.locator('.debug-status-succeeded')).toBeVisible({
    timeout: 30000
  })

  if (options.exitCode !== undefined) {
    await expect(page.locator('.debug-exit')).toHaveText(
      'exit ' + options.exitCode
    )
  }

  if (expectedOutput !== null) {
    await expect(
      page.locator('.debug-block').filter({
        hasText: 'stdout'
      }).locator('pre')
    ).toHaveText(expectedOutput)
  }
}

async function waitForDashboard(page) {
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.getByRole('button', {
    name: '新規プロジェクト',
    exact: true
  })).toBeVisible()
}

async function createTemporaryAccount(page) {
  const fixedEmail = process.env.POLIGO_E2E_EMAIL
  const fixedPassword = process.env.POLIGO_E2E_PASSWORD

  if (fixedEmail && fixedPassword) {
    await page.goto('/signin', {
      waitUntil: 'domcontentloaded'
    })

    await page.getByRole('textbox', {
      name: 'メールアドレス'
    }).fill(fixedEmail)

    await page.getByRole('textbox', {
      name: 'パスワード'
    }).fill(fixedPassword)

    await page.getByRole('button', {
      name: 'サインイン',
      exact: true
    }).click()

    await waitForDashboard()
    return
  }

  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const email = 'poligo-e2e-' + unique + '@example.com'
  const password = 'PoligoE2E_2026_' + unique

  await page.goto('/createaccount', {
    waitUntil: 'domcontentloaded'
  })

  await page.getByRole('textbox', {
    name: '表示名'
  }).fill('Poligo E2E')

  await page.getByRole('textbox', {
    name: 'メールアドレス'
  }).fill(email)

  await page.getByRole('textbox', {
    name: 'パスワード'
  }).fill(password)

  await page.getByRole('button', {
    name: 'アカウントを作成',
    exact: true
  }).click()

  await waitForDashboard()
}

async function createJavaProject(page) {
  await page.getByRole('button', {
    name: '新規プロジェクト',
    exact: true
  }).click()

  await expect(page.getByRole('button', {
    name: 'Java',
    exact: true
  })).toBeVisible()

  await page.getByRole('button', {
    name: 'Java',
    exact: true
  }).click()

  await expect(page).toHaveURL(/#\/ide\/.+/)
  await expect(page.locator('.monaco-editor')).toBeVisible()
  await expect(fileButton(page, 'Main.java')).toBeVisible()
}

async function deleteCreatedProject(page) {
  try {
    await page.goto('/#/dashboard', {
      waitUntil: 'domcontentloaded'
    })

    await waitForDashboard()

    const row = page.locator('.stack-project-list-row').filter({
      hasText: 'Java'
    }).first()

    if (await row.count()) {
      await row.locator('.stack-project-menu-button').click()
      await page.getByRole('button', {
        name: 'プロジェクトを削除',
        exact: true
      }).click()

      await expect(page.getByRole('heading', {
        name: 'プロジェクトを削除?'
      })).toBeVisible()

      await page.getByRole('button', {
        name: 'プロジェクトを削除',
        exact: true
      }).last().click()

      await expect(row).toHaveCount(0)
    }
  } catch {}
}

async function signOut(page) {
  try {
    await page.goto('/#/dashboard', {
      waitUntil: 'domcontentloaded'
    })

    await page.getByRole('button', {
      name: 'サインアウト',
      exact: true
    }).click()

    await expect(page).toHaveURL(/\/signin$/)
  } catch {}
}

test('production authenticated Java E2E', async ({ page }) => {
  let projectCreated = false

  try {
    await createTemporaryAccount(page)
    await createJavaProject(page)
    projectCreated = true

    await runAndExpect(
      page,
      'Hello from Poligo'
    )

    await openFile(page, 'Main.java')

    await setEditorContent(page, [
      'public class Main {',
      '    public static void main(String[] args) {',
      '        System.out.println(args.length);',
      '        for (String arg : args) {',
      '            System.out.println(arg);',
      '        }',
      '    }',
      '}'
    ].join('\n'))

    await runAndExpect(
      page,
      '3\nfoo\nhello world\n$literal\n',
      {
        args: 'foo "hello world" $literal'
      }
    )

    await createFile(
      page,
      '.env',
      'POLIGO_E2E=env-success'
    )

    await createFile(
      page,
      'demo/Main.java',
      [
        'package demo;',
        '',
        'import java.io.InputStream;',
        'import java.nio.charset.StandardCharsets;',
        '',
        'public class Main {',
        '    public static void main(String[] args) throws Exception {',
        '        InputStream stream = Main.class.getClassLoader().getResourceAsStream("resources/message.txt");',
        '        if (stream == null) {',
        '            throw new IllegalStateException("resource missing");',
        '        }',
        '        String resource = new String(stream.readAllBytes(), StandardCharsets.UTF_8);',
        '        System.out.println(Helper.value() + "|" + System.getenv("POLIGO_E2E") + "|" + resource + "|" + args[0]);',
        '    }',
        '}'
      ].join('\n')
    )

    await createFile(
      page,
      'demo/Helper.java',
      [
        'package demo;',
        '',
        'public class Helper {',
        '    public static String value() {',
        '        return "helper";',
        '    }',
        '}'
      ].join('\n')
    )

    await createFile(
      page,
      'resources/message.txt',
      'リソース成功'
    )

    await openFile(page, 'demo/Main.java')

    await runAndExpect(
      page,
      'helper|env-success|リソース成功|arg\n',
      {
        args: 'arg'
      }
    )

    const token = 'poligo-e2e-' + Date.now().toString(36)
    const envMarker = '/tmp/' + token + '-env'
    const argMarker = '/tmp/' + token + '-arg'

    await openFile(page, '.env')
    await setEditorContent(
      page,
      'POLIGO_E2E=$(touch ' + envMarker + ')'
    )

    await openFile(page, 'demo/Main.java')
    await setEditorContent(page, [
      'package demo;',
      '',
      'import java.nio.file.Files;',
      'import java.nio.file.Path;',
      '',
      'public class Main {',
      '    public static void main(String[] args) {',
      '        System.out.println(args[0]);',
      '        System.out.println(System.getenv("POLIGO_E2E"));',
      '        System.out.println(Files.exists(Path.of("' + envMarker + '")));',
      '        System.out.println(Files.exists(Path.of("' + argMarker + '")));',
      '    }',
      '}'
    ].join('\n'))

    await runAndExpect(
      page,
      '$(touch ' + argMarker + ')\n$(touch ' + envMarker + ')\nfalse\nfalse\n',
      {
        args: '$(touch ' + argMarker + ')'
      }
    )

    await createFile(
      page,
      'Foo.java',
      [
        'public class Foo {',
        '    public static void main(String[] args) {',
        '        System.out.println("foo-entry");',
        '    }',
        '}'
      ].join('\n')
    )

    await runAndExpect(
      page,
      'foo-entry\n'
    )

    await setEditorContent(page, [
      'import java.io.BufferedReader;',
      'import java.io.InputStreamReader;',
      '',
      'public class Foo {',
      '    public static void main(String[] args) throws Exception {',
      '        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));',
      '        System.out.println(reader.readLine());',
      '    }',
      '}'
    ].join('\n'))

    await page.getByRole('button', {
      name: 'ターミナル',
      exact: true
    }).click()

    await page.locator('.terminal').click()
    await page.keyboard.type('stdin-success')
    await page.keyboard.press('Enter')

    await page.getByRole('button', {
      name: '実行',
      exact: true
    }).click()

    await expect(page.locator('.debug-status-succeeded')).toBeVisible({
      timeout: 30000
    })

    await expect(
      page.locator('.debug-block').filter({
        hasText: 'stdout'
      }).locator('pre')
    ).toHaveText('stdin-success\n')
  } finally {
    if (projectCreated) {
      await deleteCreatedProject(page)
    }

    await signOut(page)
  }
})
