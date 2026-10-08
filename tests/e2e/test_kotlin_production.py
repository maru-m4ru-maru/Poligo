import os
import time
import uuid

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")


def set_editor_value(page, source):
    editor = page.locator(
        ".monaco-editor:visible"
    ).last
    editor.click(force=True)
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
        name="新しいファイル"
    ).click()

    name_input = page.get_by_role(
        "textbox",
        name="新しいファイル名"
    )
    expect(name_input).to_be_visible(timeout=5_000)
    name_input.fill(path)
    name_input.press("Enter")
    set_editor_value(page, source)
    page.wait_for_timeout(800)


def select_file(page, name):
    file_button = page.locator(
        '.explorer-file[title="' + name + '"] .explorer-file-main'
    )
    expect(file_button).to_be_visible(timeout=10_000)
    file_button.click()
    page.wait_for_timeout(500)


def open_debug(page):
    page.get_by_role(
        "button",
        name="Debug",
        exact=True
    ).click()
    expect(
        page.get_by_label("実行引数")
    ).to_be_visible(timeout=5_000)


def run_and_wait(page, expected_status):
    status = page.locator(".debug-status")
    panel = page.locator(".debug-panel")

    for attempt in range(3):
        page.get_by_role(
            "button",
            name="▶ 実行",
            exact=True
        ).click()

        expect(status).to_contain_text(
            expected_status,
            timeout=30_000
        )

        panel_text = panel.inner_text()

        if (
            "Execution Error 502" not in panel_text and
            "Execution Error502" not in panel_text and
            "Execution Error 503" not in panel_text and
            "Execution Error503" not in panel_text
        ):
            return status

        if attempt == 2:
            return status

        page.wait_for_timeout(2_000)

    return status


def wait_for_output(page, text):
    expect(
        page.locator(".debug-panel")
    ).to_contain_text(
        text,
        timeout=8_000
    )


def run_failed(page, expected_text):
    run_and_wait(page, "失敗")
    wait_for_output(page, expected_text)


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
        has_text="Kotlin"
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
        page.get_by_text("プロジェクトはまだありません")
    ).to_be_visible(timeout=30_000)


def enter_stdin(page, text):
    terminal = page.locator(".terminal:visible")
    expect(terminal).to_be_visible(timeout=5_000)
    expect(
        terminal
    ).to_contain_text("stdin> ", timeout=5_000)
    terminal.click()

    for character in text:
        terminal.dispatch_event(
            "keydown",
            {
                "key": character,
                "code": "Key",
                "bubbles": True,
                "cancelable": True
            }
        )

    terminal.dispatch_event(
        "keydown",
        {
            "key": "Enter",
            "code": "Enter",
            "bubbles": True,
            "cancelable": True
        }
    )


def main():
    suffix = uuid.uuid4().hex
    email = f"poligo-kotlin-e2e-{suffix}@example.invalid"
    password = "PoligoKotlinE2E!" + uuid.uuid4().hex[:18]
    env_marker = "/tmp/kotlin-e2e-" + suffix + "-env"
    arg_marker = "/tmp/kotlin-e2e-" + suffix + "-arg"

    basic_kotlin = """fun main() {
    println("Hello from Poligo Kotlin E2E")
    println("unicode=日本語🚀€")
    println("kotlin=" + KotlinVersion.CURRENT)
}"""

    main_kotlin = """import java.io.File
import java.nio.charset.StandardCharsets
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    print("no-newline|")
    println("unicode=日本語🚀€")
    System.err.println("stderr-ok")

    val stdin = readLine() ?: ""

    val values = listOf(1, 2, 3, 4)
    val sum = values.sum()

    if (sum != 10) {
        exitProcess(20)
    }

    val env = System.getenv("E2E_VALUE") ?: ""

    val resource = File("config/message.txt").readText(
        StandardCharsets.UTF_8
    )

    val temp = File("kotlin-e2e-temp.txt")
    temp.writeText(
        "filesystem-ok",
        StandardCharsets.UTF_8
    )
    val fileContent = temp.readText(
        StandardCharsets.UTF_8
    )
    temp.delete()

    println("stdin=" + stdin)
    println("env=" + env)
    println("resource=" + resource)
    println("file=" + fileContent)
    println("helper=" + helperValue())
    println("args=" + args.joinToString("|"))
}"""

    helper_kotlin = """fun helperValue(): String {
    return "helper-ok"
}"""

    injection_kotlin = """import java.io.File

fun main(args: Array<String>) {
    val env = System.getenv("E2E_VALUE") ?: ""
    val arg = args.joinToString("|")
    println(env)
    println(arg)
    println(File("/tmp/kotlin-e2e-marker").exists())
}"""

    exit_kotlin = """import kotlin.system.exitProcess

fun main() {
    System.err.println("kotlin-exit-7")
    exitProcess(7)
}"""

    compile_error_kotlin = """fun main() {
    this does not compile
}"""

    timeout_kotlin = """fun main() {
    while (true) {
    }
}"""

    nested_kotlin = """fun main() {
    println("nested-kotlin-ok")
}"""

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )
        page = context.new_page()

        try:
            print("E2E account:", email)

            page.goto(
                BASE_URL + "/createaccount?e2e=1",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            page.evaluate(
                "() => sessionStorage.setItem('poligo-e2e', '1')"
            )

            page.get_by_label("表示名").fill("Poligo Kotlin Production E2E")
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

            page.get_by_role(
                "button",
                name="新規プロジェクト"
            ).click()

            page.get_by_role(
                "button",
                name="バックエンド",
                exact=True
            ).click()

            kotlin_card = page.locator(
                ".stack-template-card"
            ).filter(
                has=page.get_by_text("Kotlin", exact=True)
            ).first

            expect(
                kotlin_card
            ).to_be_visible(timeout=10_000)
            kotlin_card.click()

            page.wait_for_url(
                "**/#/ide/*",
                timeout=60_000
            )

            expect(
                page.get_by_text("Main.kt", exact=True).last
            ).to_be_visible(timeout=30_000)

            set_editor_value(page, basic_kotlin)
            open_debug(page)
            run_and_wait(page, "成功")
            wait_for_output(page, "Hello from Poligo Kotlin E2E")
            wait_for_output(page, "unicode=日本語🚀€")
            wait_for_output(page, "kotlin=2.1.")

            create_file(page, "helper.kt", helper_kotlin)
            create_file(page, ".env", "E2E_VALUE=env-$(not-executed)")
            create_file(page, "config/message.txt", "resource-ok")
            select_file(page, "Main.kt")

            page.get_by_role(
                "button",
                name="ターミナル",
                exact=True
            ).click()

            enter_stdin(page, "日本語入力")

            open_debug(page)
            page.get_by_label("実行引数").fill(
                'alpha "hello world" \'single quote\' "$(not-executed)"'
            )

            page.evaluate(
                """() => {
                    window.__POLIGO_KOTLIN_ORIGINAL_RUN = window.__POLIGO_E2E_SET_EDITOR__
                }"""
            )

            set_editor_value(page, main_kotlin)

            run_and_wait(page, "成功")

            for output in [
                "stdin=日本語入力",
                "env=env-$(not-executed)",
                "resource=resource-ok",
                "file=filesystem-ok",
                "helper=helper-ok",
                "args=alpha|hello world|single quote|$(not-executed)",
                "stderr-ok",
            ]:
                wait_for_output(page, output)

            create_file(page, "cmd/app/Nested.kt", nested_kotlin)
            select_file(page, "cmd/app/Nested.kt")
            page.get_by_label("実行引数").fill("")
            run_and_wait(page, "成功")
            wait_for_output(page, "nested-kotlin-ok")

            create_file(page, "cmd/injection/Injection.kt", injection_kotlin)
            select_file(page, ".env")
            set_editor_value(
                page,
                "E2E_VALUE=$(touch " + env_marker + ")"
            )
            select_file(page, "cmd/injection/Injection.kt")
            page.get_by_label("実行引数").fill(
                '"$(touch ' + arg_marker + ')"'
            )
            set_editor_value(page, injection_kotlin)
            run_and_wait(page, "成功")
            wait_for_output(page, "$(touch " + env_marker + ")")
            wait_for_output(page, "$(touch " + arg_marker + ")")
            wait_for_output(page, "false")

            set_editor_value(page, exit_kotlin)
            page.get_by_label("実行引数").fill("")
            run_failed(page, "kotlin-exit-7")

            failed_text = page.locator(
                ".debug-panel"
            ).inner_text().lower()
            assert "7" in failed_text

            set_editor_value(page, compile_error_kotlin)
            run_failed(page, "error")

            create_file(page, "cmd/timeout/Timeout.kt", timeout_kotlin)
            select_file(page, "cmd/timeout/Timeout.kt")
            run_and_wait(page, "タイムアウト")

            delete_project(page)

            page.get_by_role(
                "button",
                name="サインアウト",
                exact=True
            ).click()

            page.wait_for_url(
                "**/signin",
                timeout=30_000
            )

            print("PRODUCTION KOTLIN E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-kotlin-production-e2e-failure.png",
                full_page=True
            )
            print("PRODUCTION KOTLIN E2E: FAIL")
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
