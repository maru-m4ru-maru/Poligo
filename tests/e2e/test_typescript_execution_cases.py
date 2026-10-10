import os
import uuid

from playwright.sync_api import expect, sync_playwright

import test_typescript_production as ts


BASE_URL = ts.BASE_URL
CASE = os.getenv("POLIGO_TS_E2E_CASE", "").strip()


CASES = {
    "stdin": {
        "source": 'declare const require: any\nconst fs: any = require("fs")\nconsole.log("STDIN=" + fs.readFileSync(0, "utf8").trim())',
        "expected": "STDIN=stdin-日本語🚀",
        "stdin": "stdin-日本語🚀"
    },
    "args": {
        "source": 'declare const process: any\nconsole.log("ARGS=" + JSON.stringify(process.argv.slice(2)))',
        "expected": 'ARGS=["first","日本語 2"]',
        "args": '"first" "日本語 2"'
    },
    "resource": {
        "source": 'declare const require: any\nconst fs: any = require("fs")\nconsole.log("DATA=" + fs.readFileSync("data.txt", "utf8").trim())',
        "expected": "DATA=resource-日本語-🚀",
        "extra_files": {
            "data.txt": "resource-日本語-🚀"
        }
    },
    "environment": {
        "source": 'declare const process: any\nconsole.log("ENV=" + process.env.POLIGO_TS_E2E)',
        "expected": "ENV=environment-日本語🚀",
        "extra_files": {
            ".env": "POLIGO_TS_E2E=environment-日本語🚀"
        }
    },
    "combined": {
        "source": 'declare const process: any\ndeclare const require: any\nconst fs: any = require("fs")\nconst stdin = fs.readFileSync(0, "utf8").trim()\nconst args = process.argv.slice(2)\nconsole.log("TypeScript resources OK")\nconsole.log("ENV=" + process.env.POLIGO_TS_E2E)\nconsole.log("ARGS=" + JSON.stringify(args))\nconsole.log("STDIN=" + stdin)\nconsole.log("DATA=" + fs.readFileSync("data.txt", "utf8").trim())',
        "expected": "TypeScript resources OK",
        "args": '"first" "日本語 2"',
        "stdin": "stdin-日本語🚀",
        "extra_files": {
            ".env": "POLIGO_TS_E2E=environment-日本語🚀",
            "data.txt": "resource-日本語-🚀"
        }
    }
}


def create_account(page, email, password):
    page.goto(
        BASE_URL + "/createaccount?e2e=1",
        wait_until="domcontentloaded",
        timeout=60_000
    )
    page.evaluate(
        "() => sessionStorage.setItem('poligo-e2e', '1')"
    )
    page.get_by_label("表示名").fill("Poligo TypeScript diagnostic")
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
    if CASE not in CASES:
        raise SystemExit("Unknown TypeScript diagnostic case: " + CASE)

    case = CASES[CASE]
    suffix = uuid.uuid4().hex
    email = f"poligo-typescript-{CASE}-{suffix}@example.com"
    password = "PoligoTypeScriptDiagnostic!" + uuid.uuid4().hex[:18]

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
            print("STEP: account setup " + CASE, flush=True)
            create_account(page, email, password)

            print("STEP: " + CASE + " case", flush=True)
            ts.run_typescript_case(
                page,
                "TypeScript " + CASE,
                case["source"],
                case["expected"],
                args=case.get("args", ""),
                stdin=case.get("stdin", ""),
                extra_files=case.get("extra_files")
            )

            print("TYPECRIPT DIAGNOSTIC PASS: " + CASE, flush=True)
        except Exception:
            page.screenshot(
                path="poligo-typescript-" + CASE + "-failure.png",
                full_page=True
            )
            print("TYPECRIPT DIAGNOSTIC FAIL: " + CASE, flush=True)
            raise
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
