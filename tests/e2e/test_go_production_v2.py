# Production E2E runs against the currently live Render deployment.
# Comprehensive multi-file, nested-entrypoint, resource, environment, argument, error, and timeout coverage.
import os
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
    page.wait_for_timeout(400)


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
    page.wait_for_timeout(700)


def select_file(page, name):
    file_button = page.locator(
        '.explorer-file[title="' + name + '"] .explorer-file-main'
    )
    expect(file_button).to_be_visible(timeout=5_000)
    file_button.click()
    page.wait_for_timeout(400)


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


def wait_for_output(page, value):
    expect(
        page.locator(".debug-panel")
    ).to_contain_text(
        value,
        timeout=5_000
    )


def run_failed(page, value):
    run_and_wait(page, "失敗")
    wait_for_output(page, value)


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
        has_text="Go"
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


def main():
    suffix = uuid.uuid4().hex
    email = f"poligo-go-e2e-{suffix}@example.invalid"
    password = "PoligoGoE2E!" + uuid.uuid4().hex[:18]
    env_marker = "/tmp/go-e2e-" + suffix + "-env"
    arg_marker = "/tmp/go-e2e-" + suffix + "-arg"

    basic_go = """package main

import (
    "fmt"
    "runtime"
)

func main() {
    fmt.Println("Hello from Poligo Go E2E")
    fmt.Println(runtime.Version())
    fmt.Println("unicode=日本語🚀€")
}"""

    main_go = """package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "os"
    "strings"
)

type payload struct {
    Sum    int
    Helper string
}

func main() {
    reader := bufio.NewReader(os.Stdin)
    stdin, _ := reader.ReadString('\\n')
    stdin = strings.TrimSuffix(stdin, "\\n")

    values := []int{1, 2, 3, 4}
    sum := 0

    for _, value := range values {
        sum += value
    }

    channel := make(chan string, 1)

    go func() {
        channel <- "goroutine-ok"
    }()

    resource, err := ioutil.ReadFile("config/message.txt")
    if err != nil {
        panic("resource-read")
    }

    filesystemPath := "go-e2e-temp.txt"
    if err := ioutil.WriteFile(
        filesystemPath,
        []byte("filesystem-ok"),
        0600,
    ); err != nil {
        panic("filesystem-write")
    }

    fileContent, err := ioutil.ReadFile(filesystemPath)
    if err != nil {
        panic("filesystem-read")
    }

    if err := os.Remove(filesystemPath); err != nil {
        panic("filesystem-remove")
    }

    encoded, err := json.Marshal(payload{
        Sum:    sum,
        Helper: helperValue(),
    })
    if err != nil {
        panic("json")
    }

    fmt.Println("stdin=" + strings.TrimSpace(stdin))
    fmt.Println("env=" + os.Getenv("E2E_VALUE"))
    fmt.Println("resource=" + string(resource))
    fmt.Println("file=" + string(fileContent))
    fmt.Println("helper=" + helperValue())
    fmt.Println("init=" + fmt.Sprint(helperInitialized))
    fmt.Println("goroutine=" + <-channel)
    fmt.Println("json=" + string(encoded))
    fmt.Println("args=" + strings.Join(os.Args[1:], "|"))
}"""

    helper_go = """package main

import "fmt"

var helperInitialized = false

func init() {
    helperInitialized = true
}

func helperValue() string {
    return fmt.Sprintf("%s", "helper-ok")
}"""

    nested_main_go = """package main

import "fmt"

func main() {
    fmt.Println("nested=" + nestedHelper())
}"""

    nested_helper_go = """package main

func nestedHelper() string {
    return "nested-helper-ok"
}"""

    foo_go = """package main

import "fmt"

func main() {
    fmt.Println("foo-entry-ok")
}"""

    injection_go = """package main

import (
    "fmt"
    "os"
)

func main() {
    _, envErr := os.Stat("__ENV_MARKER__")
    _, argErr := os.Stat("__ARG_MARKER__")
    fmt.Println(os.Getenv("E2E_VALUE"))
    fmt.Println(envErr == nil)
    fmt.Println(argErr == nil)
    if len(os.Args) > 1 {
        fmt.Println(os.Args[1])
    }
}""".replace(
        "__ENV_MARKER__",
        env_marker
    ).replace(
        "__ARG_MARKER__",
        arg_marker
    )

    exit_go = """package main

import "os"

func main() {
    os.Exit(7)
}"""

    panic_go = """package main

func main() {
    panic("go-e2e-panic")
}"""

    compile_error_go = """package main

func main() {
    this does not compile
}"""

    timeout_go = """package main

func main() {
    for {
    }
}"""

    invalid_package_go = """package helper

func main() {
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

            page.get_by_label("表示名").fill("Poligo Go Production E2E")
            page.get_by_label("メールアドレス").fill(email)
            page.get_by_label("パスワード").fill(password)
            page.get_by_role(
                "button",
                name="アカウントを作成"
            ).click()

            expect(
                page.get_by_text("ダッシュボード", exact=True)
            ).to_be_visible(timeout=60_000)

            page.get_by_role(
                "button",
                name="新規プロジェクト"
            ).click()

            page.get_by_role(
                "button",
                name="バックエンド",
                exact=True
            ).click()

            go_card = page.locator(
                ".stack-template-card"
            ).filter(
                has=page.get_by_text("Go", exact=True)
            ).first
            expect(go_card).to_be_visible(timeout=10_000)
            go_card.click()

            page.wait_for_url(
                "**/#/ide/*",
                timeout=60_000
            )

            expect(
                page.get_by_text("main.go", exact=True).last
            ).to_be_visible(timeout=30_000)

            set_editor_value(page, basic_go)
            open_debug(page)
            run_and_wait(page, "成功")
            wait_for_output(page, "Hello from Poligo Go E2E")
            wait_for_output(page, "go1.")
            wait_for_output(page, "unicode=日本語🚀€")

            create_file(page, "helper.go", helper_go)
            create_file(page, ".env", "E2E_VALUE=env-$(not-executed)")
            create_file(page, "config/message.txt", "resource-ok")
            select_file(page, "main.go")

            page.get_by_role(
                "button",
                name="ターミナル",
                exact=True
            ).click()

            terminal = page.locator(".terminal:visible")
            expect(terminal).to_be_visible(timeout=5_000)
            expect(terminal).to_contain_text("stdin> ", timeout=5_000)
            terminal.click()

            for character in "日本語入力":
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

            open_debug(page)
            page.get_by_label("実行引数").fill(
                'alpha "hello world" \'single quote\' "$(not-executed)"'
            )
            set_editor_value(page, main_go)
            run_and_wait(page, "成功")

            for output in [
                "stdin=日本語入力",
                "env=env-$(not-executed)",
                "resource=resource-ok",
                "file=filesystem-ok",
                "helper=helper-ok",
                "goroutine=goroutine-ok",
                "init=true",
                "json={",
                "args=alpha|hello world|single quote|$(not-executed)"
            ]:
                wait_for_output(page, output)

            create_file(page, "cmd/app/main.go", nested_main_go)
            create_file(page, "cmd/app/helper.go", nested_helper_go)
            select_file(page, "cmd/app/main.go")
            page.get_by_label("実行引数").fill("")
            run_and_wait(page, "成功")
            wait_for_output(page, "nested=nested-helper-ok")

            create_file(page, "cmd/foo/Foo.go", foo_go)
            select_file(page, "cmd/foo/Foo.go")
            run_and_wait(page, "成功")
            wait_for_output(page, "foo-entry-ok")

            create_file(page, "cmd/injection/Injection.go", injection_go)
            select_file(page, "cmd/injection/Injection.go")
            page.get_by_label("実行引数").fill(
                '"$(touch ' + arg_marker + ')"'
            )
            select_file(page, ".env")
            set_editor_value(
                page,
                "E2E_VALUE=$(touch " + env_marker + ")"
            )
            select_file(page, "cmd/injection/Injection.go")
            run_and_wait(page, "成功")

            for output in [
                "$(touch " + env_marker + ")",
                "false",
                "$(touch " + arg_marker + ")"
            ]:
                wait_for_output(page, output)

            select_file(page, "cmd/foo/Foo.go")
            set_editor_value(page, exit_go)
            page.get_by_label("実行引数").fill("")
            run_failed(page, "exit 7")

            set_editor_value(page, panic_go)
            run_failed(page, "go-e2e-panic")

            set_editor_value(page, compile_error_go)
            run_failed(page, "syntax error")

            create_file(page, "cmd/timeout/Timeout.go", timeout_go)
            select_file(page, "cmd/timeout/Timeout.go")
            run_and_wait(page, "タイムアウト")

            create_file(page, "cmd/invalid/Invalid.go", invalid_package_go)
            select_file(page, "cmd/invalid/Invalid.go")
            run_and_wait(page, "失敗")
            wait_for_output(
                page,
                "Go entrypoint must use package main"
            )

            create_file(page, "compile", "reserved")
            select_file(page, "main.go")
            set_editor_value(page, main_go)
            page.get_by_label("実行引数").fill("one")
            run_and_wait(page, "失敗")
            wait_for_output(
                page,
                "compile and run are reserved filenames for Go multi-file execution"
            )

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

            print("PRODUCTION GO E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-go-production-e2e-failure.png",
                full_page=True
            )
            print("PRODUCTION GO E2E: FAIL")
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
