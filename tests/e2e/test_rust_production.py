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
        has_text="Rust"
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
    email = f"poligo-rust-e2e-{suffix}@example.invalid"
    password = "PoligoRustE2E!" + uuid.uuid4().hex[:18]

    basic_rust = """fn main() {
    println!("Hello from Poligo Rust E2E");
    println!("unicode=日本語🚀€");
    println!("rustc={}", rustc_version());
    println!("arch={}", std::env::consts::ARCH);
}

fn rustc_version() -> String {
    let output = std::process::Command::new("rustc")
        .arg("--version")
        .output()
        .unwrap();

    String::from_utf8_lossy(&output.stdout).trim().to_string()
}"""

    feature_rust = """use std::collections::BTreeMap;

fn classify(value: i32) -> &'static str {
    match value {
        0 => "zero",
        1..=3 => "small",
        _ if value % 2 == 0 => "even",
        _ => "odd",
    }
}

fn main() {
    let values = [1, 2, 3, 4, 5];
    let doubled: Vec<i32> = values
        .iter()
        .filter(|value| **value % 2 == 0)
        .map(|value| value * 2)
        .collect();

    let mut map = BTreeMap::new();
    map.insert("name", "maru");
    map.insert("state", classify(4));

    let option = Some("safe");
    let result: Result<i32, &str> = Ok(42);

    println!("collection={:?}", doubled);
    println!("sum={}", values.iter().sum::<i32>());
    println!("match={}", classify(2));
    println!("option={}", option.unwrap());
    println!("result={}", result.unwrap());
    println!("map={}:{}", map["name"], map["state"]);
    println!("range={}", (1..=3).map(|value| value.to_string()).collect::<Vec<_>>().join(","));
}"""

    args_rust = """fn main() {
    println!("args={}", std::env::args().skip(1).collect::<Vec<_>>().join("|"));
}"""

    main_rust = """mod helper;

use std::fs;
use std::io::{self, Read};
use std::path::Path;

fn main() {
    let mut stdin = String::new();
    io::stdin().read_to_string(&mut stdin).unwrap();

    let env = std::env::var("E2E_VALUE").unwrap_or_default();
    let resource = fs::read_to_string("config/message with space.txt").unwrap();

    let temp = Path::new("rust-e2e-temp.txt");
    fs::write(temp, "filesystem-ok").unwrap();
    let file_content = fs::read_to_string(temp).unwrap();
    fs::remove_file(temp).unwrap();

    eprintln!("stderr-ok");

    println!("stdin={}", stdin.trim_end());
    println!("env={}", env);
    println!("resource={}", resource);
    println!("file={}", file_content);
    println!("helper={}", helper::value());
    println!(
        "args={}",
        std::env::args().skip(1).collect::<Vec<_>>().join("|")
    );
    println!("env-file-exposed={}", Path::new(".env").exists());

    let marker = Path::new("rust-e2e-created.txt");
    fs::write(marker, "created").unwrap();
    println!("created={}", fs::read_to_string(marker).unwrap());
    fs::remove_file(marker).unwrap();
}"""

    helper_rust = """pub fn value() -> &'static str {
    "helper-ok"
}"""

    nested_rust = """mod helper;

fn main() {
    println!("nested={}", helper::value());
}"""

    nested_helper_rust = """pub fn value() -> &'static str {
    "nested-helper-ok"
}"""

    injection_rust = """fn main() {
    println!("{}", std::env::var("E2E_VALUE").unwrap());
    println!("{}", std::env::args().nth(1).unwrap_or_default());
}"""

    exit_rust = """fn main() {
    eprintln!("rust-exit-7");
    std::process::exit(7);
}"""

    compile_error_rust = """fn main() {
    let value: i32 = "this is not an integer";
    println!("{}", value);
}"""

    panic_rust = """fn main() {
    panic!("rust-panic-e2e");
}"""

    timeout_rust = """fn main() {
    loop {
        std::hint::spin_loop();
    }
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

            page.get_by_label("表示名").fill("Poligo Rust Production E2E")
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

            page.get_by_role(
                "button",
                name="新規プロジェクト"
            ).click()

            page.get_by_role(
                "button",
                name="バックエンド",
                exact=True
            ).click()

            rust_card = page.locator(
                ".stack-template-card"
            ).filter(
                has=page.get_by_text("Rust", exact=True)
            ).first

            expect(
                rust_card
            ).to_be_visible(timeout=10_000)
            rust_card.click()

            page.wait_for_url(
                "**/#/ide/*",
                timeout=60_000
            )

            expect(
                page.get_by_text("main.rs", exact=True).last
            ).to_be_visible(timeout=30_000)

            set_editor_value(page, basic_rust)
            open_debug(page)
            run_and_wait(page, "成功")
            wait_for_output(page, "Hello from Poligo Rust E2E")
            wait_for_output(page, "unicode=日本語🚀€")
            wait_for_output(page, "rustc ")
            wait_for_output(page, "arch=")

            set_editor_value(page, feature_rust)
            run_and_wait(page, "成功")
            for output in [
                "collection=[4, 8]",
                "sum=15",
                "match=small",
                "option=safe",
                "result=42",
                "map=maru:even",
                "range=1,2,3"
            ]:
                wait_for_output(page, output)

            set_editor_value(page, args_rust)
            page.get_by_label("実行引数").fill(
                "alpha \"hello world\" 'single quote' \"$(not-executed)\""
            )
            run_and_wait(page, "成功")
            wait_for_output(
                page,
                "args=alpha|hello world|single quote|$(not-executed)"
            )

            create_file(page, "helper.rs", helper_rust)
            create_file(page, ".env", "E2E_VALUE='env value $(not-executed)'")
            create_file(
                page,
                "config/message with space.txt",
                "resource-ok"
            )

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
            set_editor_value(page, main_rust)
            run_and_wait(page, "成功")

            for output in [
                "stdin=日本語入力",
                "env=env value $(not-executed)",
                "resource=resource-ok",
                "file=filesystem-ok",
                "helper=helper-ok",
                "args=alpha|multi-value",
                "env-file-exposed=false",
                "created=created",
                "stderr-ok"
            ]:
                wait_for_output(page, output)

            create_file(
                page,
                "cmd/nested/main.rs",
                nested_rust
            )
            create_file(
                page,
                "cmd/nested/helper.rs",
                nested_helper_rust
            )
            select_file(page, "cmd/nested/main.rs")
            page.get_by_label("実行引数").fill("")
            run_and_wait(page, "成功")
            wait_for_output(page, "nested=nested-helper-ok")

            create_file(
                page,
                "cmd/injection/Injection.rs",
                injection_rust
            )
            select_file(page, ".env")
            set_editor_value(
                page,
                "E2E_VALUE=$(not-executed)"
            )
            select_file(page, "cmd/injection/Injection.rs")
            page.get_by_label("実行引数").fill(
                '"$(not-executed)"'
            )
            set_editor_value(page, injection_rust)
            run_and_wait(page, "成功")
            wait_for_output(page, "$(not-executed)")

            set_editor_value(page, exit_rust)
            page.get_by_label("実行引数").fill("")
            run_failed(page, "rust-exit-7")
            failed_text = page.locator(".debug-panel").inner_text()
            assert "7" in failed_text

            set_editor_value(page, compile_error_rust)
            run_failed(page, "error[")

            set_editor_value(page, panic_rust)
            run_failed(page, "rust-panic-e2e")

            delete_file(page, "cmd/injection/Injection.rs")

            create_file(
                page,
                "cmd/timeout/Timeout.rs",
                timeout_rust
            )
            select_file(page, "cmd/timeout/Timeout.rs")
            page.get_by_label("実行引数").fill("")
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

            print("PRODUCTION RUST E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-rust-production-e2e-failure.png",
                full_page=True
            )
            print("PRODUCTION RUST E2E: FAIL")
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
