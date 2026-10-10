import os
import re

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")
ADMIN_EMAIL = os.getenv("POLIGO_ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("POLIGO_ADMIN_PASSWORD")
EXECUTE_CLEANUP = os.getenv("POLIGO_CLEANUP_EXECUTE") == "1"
DISPOSABLE_EMAIL = re.compile(
    r"^poligo-[a-z0-9-]+-[a-f0-9]{32}@example\.(?:invalid|com)$",
    re.IGNORECASE
)


def api_request(page, method, path):
    return page.evaluate(
        """async ({ method, path }) => {
            const response = await fetch(path, {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Poligo-Workspace':
                        localStorage.getItem('poligo-workspace-id') || ''
                }
            })

            return {
                status: response.status,
                body: await response.json().catch(() => null)
            }
        }""",
        {
            "method": method,
            "path": path
        }
    )


def main():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print(
            "SKIP: POLIGO_ADMIN_EMAIL or POLIGO_ADMIN_PASSWORD is not configured.",
            flush=True
        )
        return

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )

        try:
            page.goto(
                BASE_URL + "/signin",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            page.get_by_label("メールアドレス").fill(ADMIN_EMAIL)
            page.get_by_label("パスワード").fill(ADMIN_PASSWORD)
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

            response = api_request(page, "GET", "/api/admin/users")
            if response["status"] != 200:
                raise AssertionError(
                    "Could not list administrator users: " + str(response)
                )

            body = response.get("body") or {}
            users = body.get("users") or []
            current_admin_id = body.get("currentAdminUserId")
            candidates = [
                user for user in users
                if isinstance(user.get("email"), str)
                and DISPOSABLE_EMAIL.fullmatch(user["email"])
                and not user.get("isAdmin")
                and user.get("id") != current_admin_id
            ]

            print(
                "Disposable E2E accounts eligible for cleanup:",
                len(candidates),
                flush=True
            )

            if not EXECUTE_CLEANUP:
                print(
                    "Dry run only. Set POLIGO_CLEANUP_EXECUTE=1 to delete.",
                    flush=True
                )
                return

            # Confirm that the endpoint refuses to delete the active administrator.
            denied = api_request(
                page,
                "DELETE",
                "/api/admin/users/" + str(current_admin_id)
            )
            if denied["status"] != 403:
                raise AssertionError(
                    "Cleanup endpoint did not protect the current administrator: " +
                    str(denied)
                )

            deleted_users = 0
            deleted_projects = 0
            deleted_project_files = 0
            deleted_commits = 0
            deleted_terminal_sessions = 0

            for user in candidates:
                user_id = user.get("id")
                if not isinstance(user_id, str) or not user_id:
                    raise AssertionError(
                        "Disposable account had no valid ID."
                    )

                result = api_request(
                    page,
                    "DELETE",
                    "/api/admin/users/" + user_id
                )

                if result["status"] != 200:
                    raise AssertionError(
                        "Cleanup failed for a disposable account: " +
                        str(result)
                    )

                deletion = result.get("body") or {}
                deleted_users += 1
                deleted_projects += int(
                    deletion.get("deletedProjectCount") or 0
                )
                deleted_project_files += int(
                    deletion.get("deletedProjectFileCount") or 0
                )
                deleted_commits += int(
                    deletion.get("deletedProjectCommitCount") or 0
                )
                deleted_terminal_sessions += int(
                    deletion.get("deletedTerminalSessionCount") or 0
                )

            verification = api_request(page, "GET", "/api/admin/users")
            if verification["status"] != 200:
                raise AssertionError(
                    "Could not verify cleanup: " + str(verification)
                )

            remaining = [
                user for user in
                ((verification.get("body") or {}).get("users") or [])
                if isinstance(user.get("email"), str)
                and DISPOSABLE_EMAIL.fullmatch(user["email"])
                and not user.get("isAdmin")
                and user.get("id") != current_admin_id
            ]

            if remaining:
                raise AssertionError(
                    "Disposable accounts remained after cleanup: " +
                    str(len(remaining))
                )

            print(
                "DISPOSABLE DATA CLEANUP: PASS",
                "accounts=", deleted_users,
                "projects=", deleted_projects,
                "project_files=", deleted_project_files,
                "commits=", deleted_commits,
                "terminal_sessions=", deleted_terminal_sessions,
                flush=True
            )
        finally:
            browser.close()


if __name__ == "__main__":
    main()
