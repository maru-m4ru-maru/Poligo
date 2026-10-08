import os
import uuid

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")

ADMIN_EMAIL = os.getenv("POLIGO_ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("POLIGO_ADMIN_PASSWORD")
TARGET_EMAIL = os.getenv("POLIGO_TARGET_USER_EMAIL")
TARGET_PASSWORD = os.getenv("POLIGO_TARGET_USER_PASSWORD")
TEST_LIMIT_MIB = 16
DEFAULT_LIMIT_TEXT = "標準 15 MB"


def sign_in(page, email, password):
    page.goto(
        BASE_URL + "/signin",
        wait_until="domcontentloaded",
        timeout=60_000
    )

    page.get_by_label("メールアドレス").fill(email)
    page.get_by_label("パスワード").fill(password)
    page.get_by_role(
        "button",
        name="サインイン"
    ).click()

    page.wait_for_url(
        "**/#/dashboard",
        timeout=60_000
    )

    expect(
        page.get_by_text("ダッシュボード", exact=True)
    ).to_be_visible(timeout=30_000)


def sign_out(page):
    page.get_by_role(
        "button",
        name="サインアウト",
        exact=True
    ).click()

    page.wait_for_url(
        "**/signin",
        timeout=30_000
    )


def open_account(page):
    page.goto(
        BASE_URL + "/#/account",
        wait_until="domcontentloaded",
        timeout=60_000
    )

    expect(
        page.get_by_text("アカウント設定", exact=True)
    ).to_be_visible(timeout=30_000)


def api_request(page, method, path, payload=None):
    return page.evaluate(
        """async ({method, path, payload}) => {
            const response = await fetch(path, {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Poligo-Workspace':
                        localStorage.getItem('poligo-workspace-id') || ''
                },
                body: payload === null
                    ? undefined
                    : JSON.stringify(payload)
            })

            const body = await response.json().catch(() => null)

            return {
                status: response.status,
                body
            }
        }""",
        {
            "method": method,
            "path": path,
            "payload": payload
        }
    )


def main():
    missing = [
        name
        for name, value in [
            ("POLIGO_ADMIN_EMAIL", ADMIN_EMAIL),
            ("POLIGO_ADMIN_PASSWORD", ADMIN_PASSWORD),
            ("POLIGO_TARGET_USER_EMAIL", TARGET_EMAIL),
            ("POLIGO_TARGET_USER_PASSWORD", TARGET_PASSWORD)
        ]
        if not value
    ]

    if missing:
        raise SystemExit(
            "Missing required environment variables: " +
            ", ".join(missing)
        )

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )

        try:
            sign_in(page, ADMIN_EMAIL, ADMIN_PASSWORD)
            open_account(page)

            expect(
                page.get_by_text("ADMINISTRATION", exact=True)
            ).to_be_visible(timeout=10_000)
            expect(
                page.get_by_text(DEFAULT_LIMIT_TEXT, exact=True)
            ).to_be_visible(timeout=10_000)

            denied = api_request(
                page,
                "PUT",
                "/api/admin/users/invalid-user-id/storage-limit",
                {
                    "limitBytes": TEST_LIMIT_MIB * 1024 * 1024
                }
            )

            assert denied["status"] in {403, 404}, denied

            target_row = page.locator(
                ".account-settings-admin-row"
            ).filter(
                has_text=TARGET_EMAIL
            )
            expect(target_row).to_be_visible(timeout=10_000)

            target_input = target_row.get_by_label(
                TARGET_EMAIL + " 保存容量上限 MiB"
            )
            target_input.fill(str(TEST_LIMIT_MIB))

            target_row.get_by_role(
                "button",
                name="保存",
                exact=True
            ).click()

            expect(target_input).to_have_value(
                str(TEST_LIMIT_MIB),
                timeout=10_000
            )

            sign_out(page)

            sign_in(page, TARGET_EMAIL, TARGET_PASSWORD)
            open_account(page)

            expect(
                page.get_by_text("上限 16 MB", exact=True)
            ).to_be_visible(timeout=10_000)

            sign_out(page)

            sign_in(page, ADMIN_EMAIL, ADMIN_PASSWORD)
            open_account(page)

            target_row = page.locator(
                ".account-settings-admin-row"
            ).filter(
                has_text=TARGET_EMAIL
            )
            expect(target_row).to_be_visible(timeout=10_000)

            target_row.get_by_role(
                "button",
                name="標準値",
                exact=True
            ).click()

            expect(
                target_row.get_by_label(
                    TARGET_EMAIL + " 保存容量上限 MiB"
                )
            ).to_have_value(
                "15",
                timeout=10_000
            )

            sign_out(page)

            sign_in(page, TARGET_EMAIL, TARGET_PASSWORD)
            open_account(page)

            expect(
                page.get_by_text("上限 15 MB", exact=True)
            ).to_be_visible(timeout=10_000)

            rejected = api_request(
                page,
                "GET",
                "/api/admin/users"
            )

            assert rejected["status"] == 403, rejected

            print("PRODUCTION ADMIN STORAGE E2E: PASS")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
