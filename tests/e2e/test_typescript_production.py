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


def upload_file(page, path, source):
    print("STEP: upload file input", flush=True)
    page.locator('input[type="file"]').evaluate(
        """(input, payload) => {
            const data = new DataTransfer()
            const file = new File(
                [payload.source],
                payload.name,
                { type: "text/plain" }
            )
            data.items.add(file)
            input.files = data.files
            input.dispatchEvent(new Event("change", { bubbles: true }))
        }""",
        {"name": path, "source": source}
    )

    file_button = page.locator(
        '.explorer-file[title="' + path + '"] .explorer-file-main'
    )
    expect(file_button).to_be_visible(timeout=10_000)

    print("STEP: upload file editor", flush=True)
    file_button.click()
    page.wait_for_timeout(750)


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


def rename_file(page, name, new_name):
    file_row = page.locator(
        '.explorer-file[title="' + name + '"]'
    )
    expect(file_row).to_be_visible(timeout=5_000)

    file_row.get_by_role(
        "button",
        name="名前を変更"
    ).click()

    rename_input = file_row.locator(".explorer-file-rename")
    expect(rename_input).to_be_visible(timeout=5_000)
    rename_input.fill(new_name)
    rename_input.press("Enter")

    expect(
        page.locator('.explorer-file[title="' + new_name + '"]')
    ).to_be_visible(timeout=10_000)


def create_file(page, name, source=""):
    page.get_by_role(
        "button",
        name="新しいファイル"
    ).click()

    filename = page.get_by_label("新しいファイル名")
    expect(filename).to_be_visible(timeout=5_000)
    filename.fill(name)
    filename.press("Enter")

    open_file(page, name)

    if source:
        set_editor_value(page, source)


def run_typescript_case(
    page,
    name,
    source,
    expected,
    args="",
    stdin="",
    extra_files=None
):
    print("STEP: " + name + " project", flush=True)
    create_typescript_project(page)
    open_debug(page)

    for file_name, file_source in (extra_files or {}).items():
        create_file(page, file_name, file_source)

    open_file(page, "main.ts")
    set_editor_value(page, source)
    page.get_by_label("実行引数").fill(args)
    enter_stdin(page, stdin)
    print("STEP: " + name + " run", flush=True)
    run_and_expect_success(page, expected)
    print("PASS: " + name, flush=True)
    page.wait_for_timeout(1_000)
    delete_project(page)


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
            page.get_by_label("実行引数").fill("")
            run_and_expect_success(
                page,
                "TypeScript basic OK 日本語🚀"
            )
            print("PASS: single-file TypeScript")

            print("STEP: isolate execution features", flush=True)
            page.wait_for_timeout(1_000)
            delete_project(page)

            run_typescript_case(
                page,
                "TypeScript stdin",
                'declare const require: any\nconst fs: any = require("fs")\nconsole.log("STDIN=" + fs.readFileSync(0, "utf8").trim())',
                "STDIN=stdin-日本語🚀",
                stdin="stdin-日本語🚀"
            )

            run_typescript_case(
                page,
                "TypeScript arguments",
                'declare const process: any\nconsole.log("ARGS=" + JSON.stringify(process.argv.slice(2)))',
                'ARGS=["first","日本語 2"]',
                args='"first" "日本語 2"'
            )

            run_typescript_case(
                page,
                "TypeScript resource",
                'declare const require: any\nconst fs: any = require("fs")\nconsole.log("DATA=" + fs.readFileSync("data.txt", "utf8").trim())',
                "DATA=resource-日本語-🚀",
                extra_files={"data.txt": "resource-日本語-🚀"}
            )

            run_typescript_case(
                page,
                "TypeScript environment",
                'declare const process: any\nconsole.log("ENV=" + process.env.POLIGO_TS_E2E)',
                "ENV=environment-日本語🚀",
                extra_files={".env": "POLIGO_TS_E2E=environment-日本語🚀"}
            )

            run_typescript_case(
                page,
                "TypeScript combined execution",
                'declare const process: any\ndeclare const require: any\nconst fs: any = require("fs")\nconst stdin = fs.readFileSync(0, "utf8").trim()\nconst args = process.argv.slice(2)\nconsole.log("TypeScript resources OK")\nconsole.log("ENV=" + process.env.POLIGO_TS_E2E)\nconsole.log("ARGS=" + JSON.stringify(args))\nconsole.log("STDIN=" + stdin)\nconsole.log("DATA=" + fs.readFileSync("data.txt", "utf8").trim())',
                "TypeScript resources OK",
                args='"first" "日本語 2"',
                stdin="stdin-日本語🚀",
                extra_files={
                    ".env": "POLIGO_TS_E2E=environment-日本語🚀",
                    "data.txt": "resource-日本語-🚀"
                }
            )

            print("STEP: create TypeScript project for remaining cases", flush=True)
            create_typescript_project(page)
            open_debug(page)

            print("STEP: TSX JSX setup", flush=True)
            print("STEP: TSX rename main.ts -> main.tsx", flush=True)
            rename_file(page, "main.ts", "main.tsx")
            print("STEP: TSX open main.tsx", flush=True)
            open_file(page, "main.tsx")
            print("STEP: TSX set source", flush=True)
            set_editor_value(
                page,
                '/** @jsx h */\nfunction h(tag: string, props: any, ...children: any[]) {\n    return tag + ":" + props.value + ":" + children.join("")\n}\n\nconst value: number = 42\nconst element = <div value={value}>TSX JSX</div>\nconsole.log(element)'
            )
            page.get_by_label("実行引数").fill("")
            print("STEP: TSX JSX run", flush=True)
            run_and_expect_success(
                page,
                "div:42:TSX JSX"
            )
            print("PASS: TSX JSX execution")
            print("STEP: TSX rename main.tsx -> main.ts", flush=True)
            rename_file(page, "main.tsx", "main.ts")
            open_file(page, "main.ts")

            print("STEP: declaration entrypoint rejection", flush=True)
            open_file(page, "main.ts")
            rename_file(page, "main.ts", "main.d.ts")
            open_file(page, "main.d.ts")
            page.get_by_label("実行引数").fill("")
            run_and_expect_failure(
                page,
                "TypeScript entrypoint must be a top-level .ts or .tsx implementation file"
            )
            rename_file(page, "main.d.ts", "main.ts")
            print("PASS: declaration entrypoint rejection")

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

            print("STEP: TypeScript multi-file rejection", flush=True)
            create_file(
                page,
                "helper.ts",
                'export const helper: number = 1'
            )
            open_file(page, "main.ts")
            set_editor_value(
                page,
                'console.log("single-file scope")'
            )
            run_and_expect_failure(
                page,
                "multi-file TypeScript execution is not supported"
            )
            print("PASS: multi-file TypeScript rejection")

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
