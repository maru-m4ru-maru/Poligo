# Production storage quota E2E.
import os
import uuid

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")


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
    suffix = uuid.uuid4().hex
    email = f"poligo-storage-e2e-{suffix}@example.com"
    password = "PoligoStorageE2E!" + uuid.uuid4().hex[:18]
    project_ids = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )

        try:
            print("E2E storage account:", email)

            page.goto(
                BASE_URL + "/createaccount?e2e=1",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            page.evaluate(
                "() => sessionStorage.setItem('poligo-e2e', '1')"
            )

            page.get_by_label("表示名").fill("Poligo Storage Production E2E")
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

            expect(
                page.get_by_text("ダッシュボード", exact=True)
            ).to_be_visible(timeout=30_000)

            page.goto(
                BASE_URL + "/#/account",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            expect(
                page.get_by_text("上限 15 MB", exact=True)
            ).to_be_visible(timeout=10_000)

            payload_size = 5_000_000
            payload = "x" * payload_size

            for index in range(3):
                result = api_request(
                    page,
                    "POST",
                    "/api/projects",
                    {
                        "name": "Storage E2E " + str(index + 1),
                        "files": {
                            "payload.txt": payload
                        }
                    }
                )

                assert result["status"] == 201, result
                project_ids.append(result["body"]["id"])

            dashboard = api_request(
                page,
                "GET",
                "/api/dashboard"
            )

            assert dashboard["status"] == 200, dashboard
            storage_bytes = int(
                dashboard["body"]["stats"]["storageBytes"]
            )
            assert storage_bytes == payload_size * 3, dashboard

            rejected = api_request(
                page,
                "POST",
                "/api/projects",
                {
                    "name": "Storage E2E Overflow",
                    "files": {
                        "payload.txt": "y" * 800_000
                    }
                }
            )

            assert rejected["status"] == 400, rejected
            assert rejected["body"]["error"] == "storage limit exceeded", rejected

            account = api_request(
                page,
                "GET",
                "/api/dashboard"
            )

            assert account["status"] == 200, account
            assert (
                int(account["body"]["user"]["storageLimitBytes"]) ==
                15 * 1024 * 1024
            ), account

            print("PRODUCTION STORAGE E2E: PASS")
        finally:
            for project_id in project_ids:
                try:
                    api_request(
                        page,
                        "DELETE",
                        "/api/projects/" + project_id
                    )
                except Exception:
                    pass

            browser.close()


if __name__ == "__main__":
    main()
