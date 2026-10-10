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
EXPECTED_ADMIN_ID = "w4wupjAgyoTGTT6FlPsqd9LPhCDPgIGX"


def sign_in(page, email, password):
    page.goto(
        BASE_URL + "/signin",
        wait_until="domcontentloaded",
        timeout=60_000
    )
    page.get_by_label("メールアドレス").fill(email)
    page.get_by_label("パスワード").fill(password)
    page.get_by_role("button", name="サインイン").click()
    page.wait_for_url("**/#/dashboard", timeout=60_000)
    expect(
        page.get_by_text("ダッシュボード", exact=True)
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
            return { status: response.status, body }
        }""",
        {
            "method": method,
            "path": path,
            "payload": payload
        }
    )


def signup_attempt(page, name, username, email, password):
    return page.evaluate(
        """async ({name, username, email, password}) => {
            const response = await fetch('/api/auth/sign-up/email', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({name, username, email, password})
            })
            const body = await response.json().catch(() => null)
            return {status: response.status, body}
        }""",
        {
            "name": name,
            "username": username,
            "email": email,
            "password": password
        }
    )


def expect_rejected(result, label):
    if 200 <= result["status"] < 300:
        raise AssertionError(
            label + " was accepted unexpectedly: " + str(result)
        )


def require_status(result, expected, label):
    if result["status"] != expected:
        raise AssertionError(
            label + ": expected HTTP " + str(expected) + ", got " +
            str(result)
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

    token = uuid.uuid4().hex
    test_email_prefix = "poligo-e2e-" + token
    candidate_emails = [
        test_email_prefix + "@gmail.com",
        test_email_prefix + "@mailinator.com"
    ]
    announcement_ids = []
    target_id = None
    original_verified = None
    ban_active = False
    admin_context = None
    target_context = None
    signup_context = None
    browser = None

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        admin_context = browser.new_context(
            viewport={"width": 1440, "height": 1000}
        )
        target_context = browser.new_context(
            viewport={"width": 1440, "height": 1000}
        )
        signup_context = browser.new_context()
        admin_page = admin_context.new_page()
        target_page = target_context.new_page()
        signup_page = signup_context.new_page()

        try:
            sign_in(admin_page, ADMIN_EMAIL, ADMIN_PASSWORD)
            admin_users_response = api_request(
                admin_page,
                "GET",
                "/api/admin/users"
            )
            require_status(
                admin_users_response,
                200,
                "Administrator user listing"
            )

            admin_body = admin_users_response.get("body") or {}
            users = admin_body.get("users") or []
            admin_id = admin_body.get("currentAdminUserId")

            if admin_id != EXPECTED_ADMIN_ID:
                raise AssertionError(
                    "The signed-in administrator ID does not match the "
                    "configured Poligo administrator: " + str(admin_id)
                )

            admin_user = next(
                (user for user in users if user.get("id") == admin_id),
                None
            )
            target = next(
                (
                    user for user in users
                    if str(user.get("email", "")).lower() ==
                    TARGET_EMAIL.lower()
                ),
                None
            )

            if not admin_user or not admin_user.get("isAdmin"):
                raise AssertionError(
                    "The configured administrator is not marked as admin."
                )
            if not target:
                raise AssertionError(
                    "The configured target account was not found."
                )
            if target.get("isAdmin"):
                raise AssertionError(
                    "The target account is an administrator; refusing to "
                    "run moderation checks against it."
                )
            if target.get("isBanned"):
                raise AssertionError(
                    "The target account is already banned; refusing to "
                    "alter its existing state."
                )

            target_id = target["id"]
            original_verified = bool(target.get("emailVerified"))
            duplicate_username = next(
                (
                    user.get("username")
                    for user in users
                    if isinstance(user.get("username"), str)
                    and user.get("username")
                ),
                None
            )
            if not duplicate_username:
                raise AssertionError(
                    "No existing username is available for duplicate-name "
                    "registration coverage."
                )

            signup_page.goto(
                BASE_URL + "/",
                wait_until="domcontentloaded",
                timeout=60_000
            )
            duplicate_email_username = "poligo_email_" + token[:12]
            duplicate_name_email = test_email_prefix + "@gmail.com"
            malformed_email_username = "poligo_bad_" + token[:12]
            disposable_email_username = "poligo_temp_" + token[:12]
            signup_password = "E2E-NotARealAccount-2026!"

            duplicate_email = signup_attempt(
                signup_page,
                "Duplicate email test",
                duplicate_email_username,
                ADMIN_EMAIL,
                signup_password
            )
            expect_rejected(duplicate_email, "Duplicate email registration")

            duplicate_name = signup_attempt(
                signup_page,
                "Duplicate username test",
                duplicate_username,
                duplicate_name_email,
                signup_password
            )
            expect_rejected(
                duplicate_name,
                "Duplicate username registration"
            )

            malformed_email = signup_attempt(
                signup_page,
                "Malformed email test",
                malformed_email_username,
                "not-an-email",
                signup_password
            )
            expect_rejected(
                malformed_email,
                "Malformed email registration"
            )

            disposable_email = signup_attempt(
                signup_page,
                "Disposable email test",
                disposable_email_username,
                candidate_emails[1],
                signup_password
            )
            expect_rejected(
                disposable_email,
                "Disposable email registration"
            )

            sign_in(target_page, TARGET_EMAIL, TARGET_PASSWORD)

            denied_checks = [
                (
                    "GET",
                    "/api/admin/users",
                    None,
                    403,
                    "Non-admin user listing"
                ),
                (
                    "PUT",
                    "/api/admin/users/" + target_id + "/storage-limit",
                    {"limitBytes": 16 * 1024 * 1024},
                    403,
                    "Non-admin storage-limit mutation"
                ),
                (
                    "PUT",
                    "/api/admin/users/" + target_id + "/verification",
                    {"verified": not original_verified},
                    403,
                    "Non-admin verification mutation"
                ),
                (
                    "PUT",
                    "/api/admin/users/" + target_id + "/ban",
                    {"banned": True, "reason": "E2E permission check"},
                    403,
                    "Non-admin ban mutation"
                ),
                (
                    "POST",
                    "/api/admin/announcements",
                    {
                        "title": "Must not be created " + token,
                        "message": "Non-admin permission check",
                        "targetUserId": target_id
                    },
                    403,
                    "Non-admin announcement creation"
                )
            ]

            for method, path, payload, status, label in denied_checks:
                require_status(
                    api_request(target_page, method, path, payload),
                    status,
                    label
                )

            global_title = "E2E global " + token
            global_message = "Global announcement regression check " + token
            target_title = "E2E private " + token
            target_message = "Private announcement regression check " + token

            global_result = api_request(
                admin_page,
                "POST",
                "/api/admin/announcements",
                {
                    "title": global_title,
                    "message": global_message,
                    "targetUserId": None
                }
            )
            require_status(global_result, 201, "Create global announcement")
            global_id = (global_result.get("body") or {}).get(
                "announcement", {}
            ).get("id")
            if global_id:
                announcement_ids.append(global_id)

            targeted_result = api_request(
                admin_page,
                "POST",
                "/api/admin/announcements",
                {
                    "title": target_title,
                    "message": target_message,
                    "targetUserId": target_id
                }
            )
            require_status(
                targeted_result,
                201,
                "Create user-targeted announcement"
            )
            targeted_id = (targeted_result.get("body") or {}).get(
                "announcement", {}
            ).get("id")
            if targeted_id:
                announcement_ids.append(targeted_id)

            admin_announcements = api_request(
                admin_page,
                "GET",
                "/api/announcements"
            )
            require_status(
                admin_announcements,
                200,
                "Administrator announcement feed"
            )
            admin_titles = {
                item.get("title")
                for item in (
                    (admin_announcements.get("body") or {}).get(
                        "announcements"
                    ) or []
                )
            }
            if global_title not in admin_titles:
                raise AssertionError(
                    "Global announcement was not visible to the administrator."
                )
            if target_title in admin_titles:
                raise AssertionError(
                    "User-targeted announcement leaked to the administrator."
                )

            target_announcements = api_request(
                target_page,
                "GET",
                "/api/announcements"
            )
            require_status(
                target_announcements,
                200,
                "Target user announcement feed"
            )
            target_titles = {
                item.get("title")
                for item in (
                    (target_announcements.get("body") or {}).get(
                        "announcements"
                    ) or []
                )
            }
            if global_title not in target_titles:
                raise AssertionError(
                    "Global announcement was not visible to the target user."
                )
            if target_title not in target_titles:
                raise AssertionError(
                    "User-targeted announcement was not visible to its target."
                )

            verification_result = api_request(
                admin_page,
                "PUT",
                "/api/admin/users/" + target_id + "/verification",
                {"verified": not original_verified}
            )
            require_status(
                verification_result,
                200,
                "Change target email verification state"
            )
            verification_body = verification_result.get("body") or {}
            if bool(
                (verification_body.get("user") or {}).get("emailVerified")
            ) != (not original_verified):
                raise AssertionError(
                    "The email verification state did not change as requested."
                )

            restore_verification = api_request(
                admin_page,
                "PUT",
                "/api/admin/users/" + target_id + "/verification",
                {"verified": original_verified}
            )
            require_status(
                restore_verification,
                200,
                "Restore original email verification state"
            )

            ban_result = api_request(
                admin_page,
                "PUT",
                "/api/admin/users/" + target_id + "/ban",
                {"banned": True, "reason": "Poligo automated regression test"}
            )
            require_status(ban_result, 200, "Ban target account")
            ban_active = True

            revoked_session = api_request(
                target_page,
                "GET",
                "/api/dashboard"
            )
            require_status(
                revoked_session,
                401,
                "Banned account session revocation"
            )

            unban_result = api_request(
                admin_page,
                "PUT",
                "/api/admin/users/" + target_id + "/ban",
                {"banned": False, "reason": ""}
            )
            require_status(unban_result, 200, "Unban target account")
            ban_active = False

            target_context.clear_cookies()
            sign_in(target_page, TARGET_EMAIL, TARGET_PASSWORD)
            expect(
                target_page.get_by_text("ダッシュボード", exact=True)
            ).to_be_visible(timeout=30_000)

            print(
                "PRODUCTION ADMIN AND REGISTRATION E2E: PASS",
                flush=True
            )
        finally:
            if admin_page and target_id:
                if ban_active:
                    try:
                        result = api_request(
                            admin_page,
                            "PUT",
                            "/api/admin/users/" + target_id + "/ban",
                            {"banned": False, "reason": ""}
                        )
                        require_status(result, 200, "Emergency unban")
                    except Exception as error:
                        print(
                            "WARNING: emergency unban failed: " + str(error),
                            flush=True
                        )

                if original_verified is not None:
                    try:
                        result = api_request(
                            admin_page,
                            "PUT",
                            "/api/admin/users/" + target_id + "/verification",
                            {"verified": original_verified}
                        )
                        require_status(
                            result,
                            200,
                            "Emergency verification restore"
                        )
                    except Exception as error:
                        print(
                            "WARNING: verification restore failed: " +
                            str(error),
                            flush=True
                        )

                for announcement_id in announcement_ids:
                    try:
                        result = api_request(
                            admin_page,
                            "DELETE",
                            "/api/admin/announcements/" + announcement_id
                        )
                        if result["status"] not in {200, 404}:
                            raise AssertionError(str(result))
                    except Exception as error:
                        print(
                            "WARNING: announcement cleanup failed: " +
                            str(error),
                            flush=True
                        )

                try:
                    current_users = api_request(
                        admin_page,
                        "GET",
                        "/api/admin/users"
                    )
                    if current_users["status"] == 200:
                        for user in (
                            (current_users.get("body") or {}).get("users") or []
                        ):
                            if user.get("email") in candidate_emails:
                                cleanup = api_request(
                                    admin_page,
                                    "DELETE",
                                    "/api/admin/users/" + user["id"]
                                )
                                if cleanup["status"] != 200:
                                    print(
                                        "WARNING: test-account cleanup failed: " +
                                        str(cleanup),
                                        flush=True
                                    )
                except Exception as error:
                    print(
                        "WARNING: test-account cleanup failed: " +
                        str(error),
                        flush=True
                    )

            for context in [
                signup_context,
                target_context,
                admin_context
            ]:
                if context:
                    context.close()
            browser.close()


if __name__ == "__main__":
    main()
