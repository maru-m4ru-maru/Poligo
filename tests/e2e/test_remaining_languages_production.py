import os
import re
import time
import uuid

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")


LANGUAGES = [
    {
        "title": "Python",
        "file": "main.py",
        "source": 'print("Python OK 日本語🚀")',
        "output": "Python OK 日本語🚀",
    },
    {
        "title": "C",
        "file": "main.c",
        "source": '#include <stdio.h>\n\nint main(void) {\n    printf("C OK 日本語🚀\\n");\n    return 0;\n}',
        "output": "C OK 日本語🚀",
    },
    {
        "title": "C++",
        "file": "main.cpp",
        "source": '#include <iostream>\n\nint main() {\n    std::cout << "C++ OK 日本語🚀\\n";\n    return 0;\n}',
        "output": "C++ OK 日本語🚀",
    },
    {
        "title": "PHP",
        "file": "index.php",
        "source": '<?php\necho "PHP OK 日本語🚀\\n";',
        "output": "PHP OK 日本語🚀",
    },
    {
        "title": "C#",
        "file": "main.cs",
        "source": 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("C# OK 日本語🚀");\n    }\n}',
        "output": "C# OK 日本語🚀",
    },
]


def set_editor_value(page, source):
    editor = page.locator(".monaco-editor:visible").last
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


def run_and_wait(page):
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
            value = status.inner_text()

            if value in ("成功", "失敗", "タイムアウト"):
                break

            page.wait_for_timeout(250)
        else:
            raise AssertionError("Execution did not reach a terminal status.")

        text = panel.inner_text()

        if value == "成功":
            return

        normalized_text = text.lower()
        transient = (
            "execution error" in normalized_text and
            ("502" in normalized_text or "503" in normalized_text)
        )

        if not transient or attempt == 4:
            raise AssertionError(
                "Execution failed: " + text
            )

        page.wait_for_timeout(4_000)


def create_project(page, language):
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
        has=page.get_by_text(language["title"], exact=True)
    ).first

    expect(card).to_be_visible(timeout=10_000)
    card.click()

    page.wait_for_url(
        "**/#/ide/*",
        timeout=60_000
    )

    expect(
        page.get_by_text(language["file"], exact=True).last
    ).to_be_visible(timeout=30_000)


def delete_project(page, language):
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
        has_text=language["title"]
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
    email = f"poligo-remaining-e2e-{suffix}@example.invalid"
    password = "PoligoRemainingE2E!" + uuid.uuid4().hex[:18]

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

            page.get_by_label("表示名").fill(
                "Poligo Remaining Languages E2E"
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

            for language in LANGUAGES:
                create_project(page, language)
                set_editor_value(page, language["source"])

                debug_button = page.get_by_role(
                    "button",
                    name=re.compile(r"Debug$")
                )
                expect(
                    debug_button
                ).to_be_visible(timeout=10_000)
                debug_button.click()

                expect(
                    page.get_by_label("実行引数")
                ).to_be_visible(timeout=5_000)

                run_and_wait(page)

                expect(
                    page.locator(".debug-panel")
                ).to_contain_text(
                    language["output"],
                    timeout=10_000
                )

                print(
                    "PASS:",
                    language["title"],
                    language["output"]
                )

                delete_project(page, language)

            page.get_by_role(
                "button",
                name="サインアウト",
                exact=True
            ).click()

            page.wait_for_url(
                "**/signin",
                timeout=30_000
            )

            print("PRODUCTION REMAINING LANGUAGES E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-remaining-languages-production-e2e-failure.png",
                full_page=True
            )
            print("PRODUCTION REMAINING LANGUAGES E2E: FAIL")
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
