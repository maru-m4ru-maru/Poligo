import os
import time
import uuid

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get(
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


def delete_file(page, path):
    row = page.locator(
        '.explorer-file[title="' + path + '"]'
    )
    expect(row).to_be_visible(timeout=5_000)
    row.get_by_role(
        "button",
        name="ファイルを削除"
    ).click()
    page.get_by_role(
        "button",
        name="Delete",
        exact=True
    ).click()
    expect(row).not_to_be_visible(timeout=5_000)


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

    for attempt in range(5):
        page.get_by_role(
            "button",
            name="▶ 実行",
            exact=True
        ).click()

        deadline = time.monotonic() + 30

        while time.monotonic() < deadline:
            status_text = status.inner_text()

            if status_text in ("成功", "失敗", "タイムアウト"):
                break

            page.wait_for_timeout(250)
        else:
            raise AssertionError(
                "Execution did not reach a terminal status."
            )

        panel_text = panel.inner_text()

        transient_error = (
            "Execution Error 502" in panel_text or
            "Execution Error502" in panel_text or
            "Execution Error 503" in panel_text or
            "Execution Error503" in panel_text
        )

        if expected_status in status_text:
            return status

        if not transient_error or attempt == 4:
            return status

        page.wait_for_timeout(4_000)

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
        has_text="Ruby"
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
    email = f"poligo-ruby-e2e-{suffix}@example.invalid"
    password = "PoligoRubyE2E!" + uuid.uuid4().hex[:18]
    env_marker = "/tmp/ruby-e2e-" + suffix + "-env"
    arg_marker = "/tmp/ruby-e2e-" + suffix + "-arg"

    basic_ruby = """puts "Hello from Poligo Ruby E2E"
puts "unicode=日本語🚀€"
puts "ruby=" + RUBY_VERSION
puts "encoding=" + Encoding.default_external.name"""

    feature_ruby = """require "json"

User = Struct.new(:name, :score, keyword_init: true)

user = User.new(
    name: "maru",
    score: 10
)

values = [1, 2, 3, 4, 5]
doubled = values.filter_map do |value|
    value.even? ? value * 2 : nil
end

state = user.score >= 10 ? "advanced" : "basic"

puts "json=" + JSON.generate(
    {
        name: user.name,
        score: user.score
    }
)
puts "collection=" + doubled.join(",")
puts "sum=" + values.sum.to_s
puts "ternary=" + state
puts "safe=" + user&.name&.upcase
puts "block=" + values.map { |value| value * value }.sum.to_s
puts "range=" + (1..3).to_a.join(",")"""

    single_args_ruby = """puts "args=" + ARGV.join("|")"""

    main_ruby = """require "json"
require_relative "../../lib/helper"

stdin = STDIN.readline.chomp
env = ENV.fetch("E2E_VALUE", "")
resource = File.read(
    File.expand_path("../../config/message.txt", __FILE__),
    encoding: "UTF-8"
)

temp = File.join(
    Dir.pwd,
    "ruby-e2e-temp.txt"
)

File.write(
    temp,
    "filesystem-ok",
    mode: "w",
    encoding: "UTF-8"
)

file_content = File.read(
    temp,
    encoding: "UTF-8"
)

File.delete(temp)

warn "stderr-ok"

puts "stdin=" + stdin
puts "env=" + env
puts "resource=" + resource
puts "file=" + file_content
puts "helper=" + PoligoHelper.value
puts "args=" + ARGV.join("|")
puts "json=" + JSON.generate({"status" => "ok"})
puts "env-file-exposed=" + File.exist?(".env").to_s"""

    helper_ruby = """module PoligoHelper
    def self.value
        "helper-ok"
    end
end"""

    injection_ruby = """env = ENV.fetch("E2E_VALUE", "")
arg = ARGV.join("|")

puts env
puts arg
puts File.exist?("/tmp/ruby-e2e-marker").to_s"""

    nested_ruby = """require_relative "../../lib/helper"

puts "nested=" + PoligoHelper.value"""

    exit_ruby = """warn "ruby-exit-7"
exit 7"""

    syntax_error_ruby = """def broken(
  puts "this does not compile"
end"""

    timeout_ruby = """loop do
end"""

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

            page.get_by_label("表示名").fill("Poligo Ruby Production E2E")
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

            session_check = page.evaluate(
                """async () => {
                    const response = await fetch('/api/auth/get-session', {
                        credentials: 'include',
                        cache: 'no-store'
                    })
                    const body = await response.json().catch(() => null)
                    return {
                        status: response.status,
                        user: body?.user || null
                    }
                }"""
            )

            assert session_check["status"] == 200, session_check
            assert session_check["user"], session_check

            page.goto(
                BASE_URL + "/#/dashboard",
                wait_until="domcontentloaded",
                timeout=60_000
            )

            expect(
                page.locator(".stack-dashboard")
            ).to_be_visible(timeout=30_000)

            expect(
                page.get_by_role(
                    "button",
                    name="新規プロジェクト"
                )
            ).to_be_visible(timeout=10_000)

            page.get_by_role(
                "button",
                name="新規プロジェクト"
            ).click()

            page.get_by_role(
                "button",
                name="バックエンド",
                exact=True
            ).click()

            ruby_card = page.locator(
                ".stack-template-card"
            ).filter(
                has=page.get_by_text("Ruby", exact=True)
            ).first

            expect(
                ruby_card
            ).to_be_visible(timeout=10_000)
            ruby_card.click()

            page.wait_for_url(
                "**/#/ide/*",
                timeout=60_000
            )

            expect(
                page.get_by_text("main.rb", exact=True).last
            ).to_be_visible(timeout=30_000)

            set_editor_value(page, basic_ruby)
            open_debug(page)
            run_and_wait(page, "成功")
            wait_for_output(page, "Hello from Poligo Ruby E2E")
            wait_for_output(page, "unicode=日本語🚀€")
            wait_for_output(page, "ruby=2.7.")

            set_editor_value(page, feature_ruby)
            run_and_wait(page, "成功")
            for output in [
                'json={"name":"maru","score":10}',
                "collection=4,8",
                "sum=15",
                "ternary=advanced",
                "safe=MARU",
                "block=55",
                "range=1,2,3",
            ]:
                wait_for_output(page, output)

            set_editor_value(page, single_args_ruby)
            page.get_by_label("実行引数").fill(
                "alpha \"hello world\" 'single quote' \"$(not-executed)\""
            )
            run_and_wait(page, "成功")
            wait_for_output(
                page,
                "args=alpha|hello world|single quote|$(not-executed)"
            )

            create_file(page, "lib/helper.rb", helper_ruby)
            create_file(
                page,
                ".env",
                "E2E_VALUE=env-$(not-executed)"
            )
            create_file(
                page,
                "config/message.txt",
                "resource-ok"
            )
            create_file(
                page,
                "cmd/app/Main.rb",
                main_ruby
            )

            select_file(page, "cmd/app/Main.rb")

            page.get_by_role(
                "button",
                name="ターミナル",
                exact=True
            ).click()

            enter_stdin(page, "日本語入力")

            open_debug(page)
            page.get_by_label("実行引数").fill(
                "alpha multi-value"
            )
            run_and_wait(page, "成功")

            for output in [
                "stdin=日本語入力",
                "env=env-$(not-executed)",
                "resource=resource-ok",
                "file=filesystem-ok",
                "helper=helper-ok",
                "args=alpha|multi-value",
                'json={"status":"ok"}',
                "env-file-exposed=false",
                "stderr-ok",
            ]:
                wait_for_output(page, output)

            create_file(
                page,
                "cmd/nested/Nested.rb",
                nested_ruby
            )
            select_file(page, "cmd/nested/Nested.rb")
            page.get_by_label("実行引数").fill("")
            run_and_wait(page, "成功")
            wait_for_output(page, "nested=helper-ok")

            create_file(
                page,
                "cmd/injection/Injection.rb",
                injection_ruby
            )
            select_file(page, ".env")
            set_editor_value(
                page,
                "E2E_VALUE=$(touch " + env_marker + ")"
            )
            select_file(page, "cmd/injection/Injection.rb")
            page.get_by_label("実行引数").fill(
                '"$(touch ' + arg_marker + ')"'
            )
            set_editor_value(page, injection_ruby)
            run_and_wait(page, "成功")
            wait_for_output(page, "$(touch " + env_marker + ")")
            wait_for_output(page, "$(touch " + arg_marker + ")")
            wait_for_output(page, "false")

            set_editor_value(page, exit_ruby)
            page.get_by_label("実行引数").fill("")
            run_failed(page, "ruby-exit-7")

            failed_text = page.locator(
                ".debug-panel"
            ).inner_text().lower()
            assert "7" in failed_text

            set_editor_value(page, syntax_error_ruby)
            run_failed(page, "SyntaxError")

            delete_file(page, "cmd/injection/Injection.rb")

            create_file(
                page,
                "cmd/timeout/Timeout.rb",
                timeout_ruby
            )
            select_file(page, "cmd/timeout/Timeout.rb")
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

            print("PRODUCTION RUBY E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-ruby-production-e2e-failure.png",
                full_page=True
            )
            print("PRODUCTION RUBY E2E: FAIL")
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
