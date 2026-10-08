import os
import re
import sys
import time
import uuid

sys.stdout.reconfigure(line_buffering=True)

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")


def set_editor_value(page, source):
    page.wait_for_function(
        "() => typeof window.__POLIGO_E2E_SET_EDITOR__ === 'function'",
        timeout=10_000
    )
    page.evaluate(
        "(source) => window.__POLIGO_E2E_SET_EDITOR__(source)",
        source
    )
    page.wait_for_timeout(500)


def create_file(page, path, source):
    page.get_by_role(
        "button",
        name="新しいファイル",
        exact=True
    ).click()

    name_input = page.get_by_label("新しいファイル名")
    expect(name_input).to_be_visible(timeout=5_000)
    name_input.fill(path)
    name_input.press("Enter")
    page.wait_for_timeout(300)
    set_editor_value(page, source)


def open_file(page, name):
    file_button = page.locator(
        '.explorer-file[title="' + name + '"] .explorer-file-main'
    )
    expect(file_button).to_be_visible(timeout=5_000)
    file_button.click()
    page.wait_for_timeout(400)


def open_debug(page):
    debug_button = page.get_by_role(
        "button",
        name=re.compile(r"Debug$")
    )
    expect(debug_button).to_be_visible(timeout=10_000)
    debug_button.click()
    expect(
        page.get_by_label("実行引数")
    ).to_be_visible(timeout=5_000)


def enter_stdin(page, value):
    page.wait_for_function(
        "() => typeof window.__POLIGO_E2E_SET_STDIN__ === 'function'",
        timeout=5_000
    )
    page.evaluate(
        "(value) => window.__POLIGO_E2E_SET_STDIN__(value)",
        value
    )

def wait_for_terminal_status(page, expected_status, timeout=45_000):
    status = page.locator(".debug-status")
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        value = status.inner_text()

        if value == expected_status:
            return

        if value not in ("待機中", "キュー", "実行中", "成功", "失敗", "タイムアウト"):
            raise AssertionError("Unexpected execution status: " + value)

        page.wait_for_timeout(250)

    raise AssertionError(
        "Execution did not reach " + expected_status
    )


def run_and_expect_success(page, output):
    page.get_by_role(
        "button",
        name="▶ 実行",
        exact=True
    ).click()

    wait_for_terminal_status(page, "成功")

    expect(
        page.locator(".debug-panel")
    ).to_contain_text(
        output,
        timeout=10_000
    )


def run_and_expect_failure(page, output):
    page.get_by_role(
        "button",
        name="▶ 実行",
        exact=True
    ).click()

    wait_for_terminal_status(page, "失敗")

    expect(
        page.locator(".debug-panel")
    ).to_contain_text(
        output,
        timeout=10_000
    )


def run_and_expect_timeout(page):
    page.get_by_role(
        "button",
        name="▶ 実行",
        exact=True
    ).click()

    wait_for_terminal_status(
        page,
        "タイムアウト",
        timeout=35_000
    )


def create_typescript_project(page):
    page.goto(
        BASE_URL + "/#/dashboard",
        wait_until="domcontentloaded",
        timeout=60_000
    )
    expect(
        page.get_by_text("ダッシュボード", exact=True)
    ).to_be_visible(timeout=30_000)

    page.get_by_role(
        "button",
        name="新規プロジェクト"
    ).click()

    page.get_by_role(
        "button",
        name="バックエンド",
        exact=True
    ).click()

    card = page.locator(
        ".stack-template-card"
    ).filter(
        has=page.get_by_text("TypeScript", exact=True)
    ).first

    expect(card).to_be_visible(timeout=10_000)
    card.click()

    page.wait_for_url(
        "**/#/ide/*",
        timeout=60_000
    )

    expect(
        page.get_by_text("main.ts", exact=True).last
    ).to_be_visible(timeout=30_000)


def delete_project(page):
    page.goto(
        BASE_URL + "/#/dashboard",
        wait_until="domcontentloaded",
        timeout=60_000
    )
    expect(
        page.get_by_text("ダッシュボード", exact=True)
    ).to_be_visible(timeout=30_000)

    row = page.locator(
        ".stack-project-list-row:visible"
    ).filter(
        has_text="TypeScript"
    ).first

    expect(row).to_be_visible(timeout=10_000)
    row.locator(".stack-project-menu-button").click()

    page.locator('[role="menu"]').get_by_role(
        "button",
        name="プロジェクトを削除"
    ).click()

    page.get_by_role(
        "button",
        name="プロジェクトを削除"
    ).last.click()

    expect(
        row
    ).not_to_be_visible(timeout=30_000)


def main():
    suffix = uuid.uuid4().hex
    email = f"poligo-typescript-e2e-{suffix}@example.invalid"
    password = "PoligoTypeScriptE2E!" + uuid.uuid4().hex[:18]

    with sync_playwright() as playwright:
        print("STEP: launch browser", flush=True)
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )
        page = context.new_page()
        page.set_default_timeout(15_000)
        page.set_default_navigation_timeout(20_000)

        try:
            print("STEP: account setup " + email, flush=True)

            page.goto(
                BASE_URL + "/createaccount?e2e=1",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            page.evaluate(
                "() => sessionStorage.setItem('poligo-e2e', '1')"
            )

            page.get_by_label("表示名").fill(
                "Poligo TypeScript E2E"
            )
            page.get_by_label("メールアドレス").fill(email)
            page.get_by_label("パスワード").fill(password)
            page.get_by_role(
                "button",
                name="アカウントを作成"
            ).click()

            page.wait_for_url(
                "**/#/dashboard",
                timeout=60_000
            )

            print("STEP: create TypeScript project", flush=True)
            create_typescript_project(page)
            print("STEP: open debug", flush=True)
            open_debug(page)

            print("STEP: single-file setup", flush=True)
            set_editor_value(
                page,
                'interface Greeting {\n    message: string\n}\n\nconst greeting: Greeting = {\n    message: "TypeScript basic OK 日本語🚀"\n}\n\nconsole.log(greeting.message)'
            )
            run_and_expect_success(
                page,
                "TypeScript basic OK 日本語🚀"
            )
            print("PASS: single-file TypeScript")

            print("STEP: additional resources setup", flush=True)
            create_file(
                page,
                "data.txt",
                "resource-日本語-🚀"
            )
            create_file(
                page,
                ".env",
                "POLIGO_TS_E2E=environment-日本語🚀"
            )
            open_file(page, "main.ts")
            print("STEP: set resource-aware main.ts", flush=True)
            set_editor_value(
                page,
                'declare const process: any\ndeclare const require: any\n\nconst fs: any = require("fs")\nconst data = fs.readFileSync("data.txt", "utf8").trim()\nconst stdin = fs.readFileSync(0, "utf8").trim()\nconst args = process.argv.slice(2)\n\nconsole.log("TypeScript resources OK")\nconsole.log("ENV=" + process.env.POLIGO_TS_E2E)\nconsole.log("ARGS=" + JSON.stringify(args))\nconsole.log("DATA=" + data)\nconsole.log("STDIN=" + stdin)\nfs.writeFileSync("created.txt", "filesystem-ok")\nconsole.log("FILE=" + fs.readFileSync("created.txt", "utf8"))'
            )
            print("STEP: set args", flush=True)
            page.get_by_label("実行引数").fill(
                '"" "日本語 2"'
            )
            print("STEP: set stdin", flush=True)
            enter_stdin(
                page,
                "stdin-日本語🚀"
            )
            print("STEP: run resource-aware TypeScript", flush=True)
            run_and_expect_success(
                page,
                "TypeScript resources OK"
            )

            panel = page.locator(".debug-panel")
            expect(panel).to_contain_text(
                "ENV=environment-日本語🚀",
                timeout=10_000
            )
            expect(panel).to_contain_text(
                'ARGS=["", "日本語 2"]',
                timeout=10_000
            )
            expect(panel).to_contain_text(
                "DATA=resource-日本語-🚀",
                timeout=10_000
            )
            expect(panel).to_contain_text(
                "STDIN=stdin-日本語🚀",
                timeout=10_000
            )
            expect(panel).to_contain_text(
                "FILE=filesystem-ok",
                timeout=10_000
            )
            print("PASS: environment, args, stdin, resources, filesystem")

            print("STEP: TSX setup", flush=True)
            create_file(
                page,
                "main.tsx",
                'const value: number = 42\nconsole.log("TSX OK", value)'
            )
            open_file(page, "main.tsx")
            page.get_by_label("実行引数").fill("")
            run_and_expect_success(
                page,
                "TSX OK 42"
            )
            print("PASS: TSX")

            print("STEP: compile error setup", flush=True)
            open_file(page, "main.ts")
            set_editor_value(
                page,
                'const broken: number = "compile error"\nconsole.log(broken)'
            )
            run_and_expect_failure(page, "TS2322")
            print("PASS: compile error")

            print("STEP: runtime error setup", flush=True)
            set_editor_value(
                page,
                'declare const process: any\nconsole.error("runtime error-日本語🚀")\nprocess.exitCode = 7'
            )
            run_and_expect_failure(
                page,
                "runtime error-日本語🚀"
            )
            print("PASS: nonzero exit and stderr")

            set_editor_value(
                page,
                "while (true) {}"
            )
            page.get_by_label("実行引数").fill("")
            run_and_expect_timeout(page)
            print("PASS: timeout")

            print("STEP: delete project", flush=True)
            page.wait_for_timeout(1_500)
            delete_project(page)

            print("STEP: sign out", flush=True)
            page.get_by_role(
                "button",
                name="サインアウト",
                exact=True
            ).click()

            page.wait_for_url(
                "**/signin",
                timeout=30_000
            )

            print("PRODUCTION TYPESCRIPT E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-typescript-production-e2e-failure.png",
                full_page=True
            )
            print("PRODUCTION TYPESCRIPT E2E: FAIL")
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
