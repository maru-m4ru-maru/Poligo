import time
import uuid

from playwright.sync_api import expect, sync_playwright

import test_typescript_production as ts


BASE_URL = ts.BASE_URL
API_URL = "https://poligo-api-g0wc.onrender.com"


def create_account(page, email, password):
    page.goto(
        BASE_URL + "/createaccount?e2e=1",
        wait_until="domcontentloaded",
        timeout=60_000
    )
    page.evaluate(
        "() => sessionStorage.setItem('poligo-e2e', '1')"
    )
    page.get_by_label("表示名").fill("Poligo TypeScript API diagnostic")
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


def main():
    suffix = uuid.uuid4().hex
    email = f"poligo-typescript-api-{suffix}@example.invalid"
    password = "PoligoTypeScriptAPIDiagnostic!" + uuid.uuid4().hex[:18]

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
        page.set_default_navigation_timeout(20_000)

        try:
            print("STEP: account setup", flush=True)
            create_account(page, email, password)

            print("STEP: create TypeScript project", flush=True)
            ts.create_typescript_project(page)

            print("STEP: fetch projects", flush=True)
            projects_response = page.request.get(
                API_URL + "/api/projects",
                timeout=15_000
            )
            expect(projects_response).to_be_ok()
            projects = projects_response.json()
            if len(projects) != 1:
                raise AssertionError(
                    "Expected exactly one project, got " +
                    str(projects)
                )
            project_id = projects[0]["id"]
            print("PROJECT ID: " + project_id, flush=True)

            source = (
                '(globalThis as any).process = (globalThis as any).process || {};\n'
                '(globalThis as any).process.env = (globalThis as any).process.env || {};\n'
                'Object.assign((globalThis as any).process.env, {"POLIGO_TS_E2E":"environment-日本語🚀"});\n'
                'declare const process: any\n'
                'console.log("ENV=" + process.env.POLIGO_TS_E2E)'
            )

            payload = {
                "projectId": project_id,
                "language": "typescript",
                "entrypoint": "main.ts",
                "stdin": "",
                "args": [],
                "files": {
                    "main.ts": source,
                    ".env": "POLIGO_TS_E2E=environment-日本語🚀"
                }
            }

            print("STEP: direct execution submit", flush=True)
            execution_response = page.request.post(
                API_URL + "/api/executions",
                data=payload,
                timeout=60_000
            )
            print(
                "SUBMIT STATUS: " +
                str(execution_response.status),
                flush=True
            )
            body = execution_response.json()
            print("SUBMIT BODY: " + str(body), flush=True)

            expect(execution_response).to_be_ok()
            execution_id = body["id"]

            for attempt in range(60):
                status_response = page.request.get(
                    API_URL + "/api/executions/" + execution_id,
                    timeout=15_000
                )
                status_body = status_response.json()
                print(
                    "STATUS " +
                    str(attempt + 1) +
                    ": " +
                    str(status_body),
                    flush=True
                )

                if status_body.get("status") in {
                    "succeeded",
                    "failed",
                    "timeout"
                }:
                    status = status_body["status"]
                    result = status_body.get("result") or {}

                    if status != "succeeded":
                        raise AssertionError(
                            "TypeScript API diagnostic failed: " +
                            str(status_body)
                        )

                    if "ENV=environment-日本語🚀" not in result.get(
                        "stdout",
                        ""
                    ):
                        raise AssertionError(
                            "Unexpected TypeScript environment output: " +
                            str(result)
                        )

                    print(
                        "DIRECT TYPESCRIPT API ENVIRONMENT: PASS",
                        flush=True
                    )
                    return

                time.sleep(1)

            raise AssertionError(
                "TypeScript API execution did not finish"
            )
        except Exception:
            page.screenshot(
                path="poligo-typescript-api-environment-failure.png",
                full_page=True
            )
            print(
                "DIRECT TYPESCRIPT API ENVIRONMENT: FAIL",
                flush=True
            )
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
