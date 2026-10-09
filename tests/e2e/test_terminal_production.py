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
API_URL = os.getenv(
    "POLIGO_API_URL",
    "https://poligo-api-g0wc.onrender.com"
).rstrip("/")


def terminal_status(page):
    return page.evaluate(
        """() => window.__POLIGO_E2E_TERMINAL__
          ? window.__POLIGO_E2E_TERMINAL__.status()
          : null"""
    )


def terminal_text(page):
    return page.evaluate(
        """() => window.__POLIGO_E2E_TERMINAL__
          ? window.__POLIGO_E2E_TERMINAL__.readText()
          : ''"""
    )


def wait_for_terminal(page, timeout=120):
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        status = terminal_status(page)

        if status and status.get("status") == "connected":
            return status

        if page.locator(".terminal-connection-overlay").count():
            message = page.locator(
                ".terminal-connection-message"
            ).inner_text()
            if "Terminal connection unavailable" in page.locator(
                ".terminal-connection-title"
            ).inner_text():
                if time.monotonic() + 3 >= deadline:
                    raise AssertionError(
                        "Terminal connection error: " + message
                    )

        page.wait_for_timeout(250)

    raise AssertionError(
        "Terminal did not connect. status=" +
        str(terminal_status(page)) +
        " text=" + terminal_text(page)[-3000:]
    )


def wait_for_line(page, expected, timeout=20):
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        lines = terminal_text(page).splitlines()

        if any(line.strip() == expected for line in lines):
            return

        page.wait_for_timeout(200)

    raise AssertionError(
        "Terminal output line not found: " + expected +
        "\\nTerminal output:\\n" + terminal_text(page)[-5000:]
    )


def run_command(page, command, expected, timeout=20):
    page.evaluate(
        "() => window.__POLIGO_E2E_TERMINAL__.focus()"
    )
    page.keyboard.type(command, delay=1)
    page.keyboard.press("Enter")
    wait_for_line(page, expected, timeout)


def cookie_headers(context, page):
    cookies = context.cookies()
    cookie_header = "; ".join(
        cookie["name"] + "=" + cookie["value"]
        for cookie in cookies
    )
    workspace_id = page.evaluate(
        "() => localStorage.getItem('poligo-workspace-id') || ''"
    )
    return {
        "Cookie": cookie_header,
        "Origin": BASE_URL,
        "X-Poligo-Workspace": workspace_id
    }


def create_project(page):
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

    template = page.locator(
        ".stack-template-card"
    ).filter(
        has=page.get_by_text("TypeScript", exact=True)
    ).first

    expect(template).to_be_visible(timeout=10_000)
    template.click()

    page.wait_for_url(
        "**/#/ide/*",
        timeout=60_000
    )
    expect(
        page.get_by_text("main.ts", exact=True).last
    ).to_be_visible(timeout=30_000)

    project_id = page.evaluate(
        "() => window.location.hash.split('/').pop()"
    )

    if not project_id:
        raise AssertionError("Project ID was not present in the IDE route")

    page.locator(".bottom-tab").filter(
        has_text="ターミナル"
    ).click()

    page.wait_for_function(
        "() => Boolean(window.__POLIGO_E2E_TERMINAL__)",
        timeout=10_000
    )
    wait_for_terminal(page)

    return project_id


def delete_project(page, project_id):
    if not project_id:
        return

    headers = cookie_headers(page.context, page)
    response = page.request.delete(
        API_URL + "/api/projects/" + project_id,
        headers=headers,
        timeout=20_000
    )

    if response.status not in (200, 204, 404):
        print(
            "Cleanup project status:",
            response.status,
            response.text()[:500],
            flush=True
        )


def main():
    suffix = uuid.uuid4().hex
    email = "poligo-terminal-e2e-" + suffix + "@example.invalid"
    password = "PoligoTerminalE2E!" + uuid.uuid4().hex[:18]
    project_id = ""

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )
        page = context.new_page()
        page.set_default_timeout(15_000)
        page.set_default_navigation_timeout(30_000)

        try:
            print("STEP: create disposable account", flush=True)
            page.goto(
                BASE_URL + "/createaccount?e2e=1",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            page.evaluate(
                "() => sessionStorage.setItem('poligo-e2e', '1')"
            )
            page.get_by_label("表示名").fill("Poligo Terminal E2E")
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

            print("STEP: create project and connect PTY", flush=True)
            project_id = create_project(page)

            status = terminal_status(page)
            if not status or not status.get("sessionId"):
                raise AssertionError(
                    "Terminal connection did not return a session ID: " +
                    str(status)
                )

            print("PASS: authenticated session and WebSocket", flush=True)

            print("STEP: keyboard input and working directory", flush=True)
            page.evaluate(
                "() => window.__POLIGO_E2E_TERMINAL__.focus()"
            )
            page.keyboard.type("pwd", delay=2)
            page.keyboard.press("Enter")

            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                text = terminal_text(page)
                if "/poligo-terminal-sessions/" in text:
                    break
                page.wait_for_timeout(200)
            else:
                raise AssertionError(
                    "Terminal keyboard input or working directory failed: " +
                    terminal_text(page)[-4000:]
                )

            print("PASS: keyboard input and working directory", flush=True)

            print("STEP: shell commands and runtimes", flush=True)
            run_command(
                page,
                "printf 'KEYBOARD_INPUT_OK\\n'",
                "KEYBOARD_INPUT_OK"
            )
            run_command(
                page,
                "node -e \"console.log('NODE_RUNTIME_OK')\"",
                "NODE_RUNTIME_OK"
            )
            run_command(
                page,
                "python3 -c \"print('PYTHON_RUNTIME_OK')\"",
                "PYTHON_RUNTIME_OK"
            )
            run_command(
                page,
                "printf 'STDERR_STREAM_OK\\n' >&2",
                "STDERR_STREAM_OK"
            )
            run_command(
                page,
                "printf 'PIPE_OK:%s\\n' \"$(printf x | wc -c)\"",
                "PIPE_OK:1"
            )
            run_command(
                page,
                "printf 'UTF8_日本語🚀_OK\\n'",
                "UTF8_日本語🚀_OK"
            )
            print("PASS: shell commands, Node, Python, stderr, pipes, and UTF-8", flush=True)

            print("STEP: project file read and creation", flush=True)
            run_command(
                page,
                "test -f main.ts && printf 'PROJECT_FILE_READ_OK\\n'",
                "PROJECT_FILE_READ_OK"
            )
            run_command(
                page,
                "printf 'TERMINAL_FILE_SYNC_OK' > terminal-created.txt && printf 'FILE_WRITE_OK\\n'",
                "FILE_WRITE_OK"
            )

            headers = cookie_headers(context, page)
            response = page.request.get(
                API_URL + "/api/projects/" + project_id,
                headers=headers,
                timeout=20_000
            )

            if not 200 <= response.status < 300:
                raise AssertionError(
                    "Could not read the project after terminal sync: " +
                    str(response.status) + " " + response.text()[:1000]
                )

            deadline = time.monotonic() + 45
            synced = False

            while time.monotonic() < deadline:
                response = page.request.get(
                    API_URL + "/api/projects/" + project_id,
                    headers=headers,
                    timeout=20_000
                )

                if 200 <= response.status < 300:
                    body = response.json()
                    files = body.get("files") or {}

                    if files.get("terminal-created.txt") == "TERMINAL_FILE_SYNC_OK":
                        synced = True
                        break

                page.wait_for_timeout(1000)

            if not synced:
                raise AssertionError(
                    "Terminal-created file did not sync to project storage"
                )

            print("PASS: terminal file synchronization to project storage", flush=True)

            print("STEP: shell status and Ctrl+C", flush=True)
            run_command(
                page,
                "false; printf 'EXIT_CODE:%s\\n' \"$?\"",
                "EXIT_CODE:1"
            )

            page.evaluate(
                "() => window.__POLIGO_E2E_TERMINAL__.focus()"
            )
            page.keyboard.type("sleep 15", delay=1)
            page.keyboard.press("Enter")
            page.wait_for_timeout(500)
            page.keyboard.press("Control+c")

            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                text = terminal_text(page)
                if "^C" in text:
                    break
                page.wait_for_timeout(200)
            else:
                raise AssertionError(
                    "Ctrl+C did not interrupt the running command: " +
                    terminal_text(page)[-4000:]
                )

            run_command(
                page,
                "printf 'PTY_RECOVERED_OK\\n'",
                "PTY_RECOVERED_OK"
            )
            print("PASS: exit code, Ctrl+C, and continued interaction", flush=True)

            print("STEP: terminal resize and output scrolling", flush=True)
            page.set_viewport_size({"width": 1100, "height": 800})
            page.wait_for_timeout(500)
            page.evaluate(
                "() => window.__POLIGO_E2E_TERMINAL__.focus()"
            )
            run_command(
                page,
                "for i in $(seq 1 80); do printf 'SCROLL_LINE_%s\\n' \"$i\"; done; printf 'SCROLL_TEST_DONE\\n'",
                "SCROLL_TEST_DONE",
                timeout=20
            )
            text = terminal_text(page)
            if "SCROLL_LINE_80" not in text:
                raise AssertionError("Terminal scroll output was incomplete")
            print("PASS: resize and scroll output", flush=True)

            print("HOSTED TERMINAL PRODUCTION E2E: PASS", flush=True)
        except Exception:
            page.screenshot(
                path="poligo-terminal-production-e2e-failure.png",
                full_page=True
            )
            raise
        finally:
            if project_id:
                delete_project(page, project_id)
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
