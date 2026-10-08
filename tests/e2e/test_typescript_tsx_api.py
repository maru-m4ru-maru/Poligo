import json
import time
import uuid

from playwright.sync_api import sync_playwright

import test_typescript_production as ts


BASE_URL = ts.BASE_URL
API_URL = "https://poligo-api-g0wc.onrender.com"


def create_account(page, email, password):
    page.goto(
        BASE_URL + "/createaccount?e2e=1",
        wait_until="domcontentloaded",
        timeout=60_000
    )
    page.evaluate("() => sessionStorage.setItem('poligo-e2e', '1')")
    page.get_by_label("表示名").fill("Poligo TSX API diagnostic")
    page.get_by_label("メールアドレス").fill(email)
    page.get_by_label("パスワード").fill(password)
    page.get_by_role(
        "button",
        name="アカウントを作成"
    ).click()
    page.wait_for_url("**/#/dashboard", timeout=60_000)


def main():
    suffix = uuid.uuid4().hex
    email = f"poligo-tsx-{suffix}@example.invalid"
    password = "PoligoTSXAPIDiagnostic!" + uuid.uuid4().hex[:18]

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

            cookies = context.cookies()
            cookie_header = "; ".join(
                cookie["name"] + "=" + cookie["value"]
                for cookie in cookies
            )
            headers = {
                "Cookie": cookie_header,
                "Origin": BASE_URL
            }

            print("STEP: fetch projects", flush=True)
            projects_response = page.request.get(
                API_URL + "/api/projects",
                headers=headers,
                timeout=15_000
            )
            projects = json.loads(projects_response.text())
            project_id = projects[0]["id"]

            source = (
                "/** @jsx h */\n"
                "function h(tag: string, props: any, ...children: any[]) {\n"
                "    return tag + ':' + props.value + ':' + children.join('')\n"
                "}\n"
                "const value: number = 42\n"
                "const element = <div value={value}>TSX JSX</div>\n"
                "console.log(element)"
            )

            payload = {
                "projectId": project_id,
                "language": "typescript",
                "entrypoint": "main.tsx",
                "stdin": "",
                "args": [],
                "files": {
                    "main.tsx": source
                }
            }

            print("STEP: direct TSX submit", flush=True)
            response = page.request.post(
                API_URL + "/api/executions",
                data=payload,
                headers=headers,
                timeout=60_000
            )
            print(
                "SUBMIT STATUS: " + str(response.status),
                flush=True
            )
            body = response.json()
            print("SUBMIT BODY: " + str(body), flush=True)

            if not 200 <= response.status < 300:
                raise AssertionError(str(body))

            execution_id = body["id"]

            for attempt in range(60):
                status_response = page.request.get(
                    API_URL + "/api/executions/" + execution_id,
                    headers=headers,
                    timeout=15_000
                )

                if not 200 <= status_response.status < 300:
                    raise AssertionError(
                        status_response.text()
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
                    if status_body["status"] != "succeeded":
                        raise AssertionError(str(status_body))

                    stdout = (status_body.get("result") or {}).get(
                        "stdout",
                        ""
                    )

                    if "div:42:TSX JSX" not in stdout:
                        raise AssertionError(
                            "Unexpected TSX output: " + str(status_body)
                        )

                    print("DIRECT TSX API: PASS", flush=True)
                    return

                time.sleep(1)

            raise AssertionError(
                "TSX API execution did not finish"
            )
        except Exception:
            page.screenshot(
                path="poligo-typescript-tsx-api-failure.png",
                full_page=True
            )
            print("DIRECT TSX API: FAIL", flush=True)
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
