import os
import time
import uuid

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.getenv(
    "POLIGO_WEB_URL",
    "https://poligo-web-2n2l.onrender.com"
).rstrip("/")


def set_editor_value(page, source):
    editor = page.locator(
        ".monaco-editor:visible textarea.inputarea"
    ).last
    editor.fill(source, force=True)


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
    page.wait_for_timeout(1_000)


def select_file(page, name):
    page.get_by_text(name, exact=True).last.click()
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
    page.get_by_role(
        "button",
        name="▶ 実行",
        exact=True
    ).click()

    page.wait_for_timeout(250)

    status = page.locator(".debug-status")

    expect(status).to_contain_text(
        expected_status,
        timeout=30_000
    )

    return status


def wait_for_output(page, text):
    expect(
        page.locator(".debug-panel")
    ).to_contain_text(
        text,
        timeout=5_000
    )


def main():
    suffix = uuid.uuid4().hex
    email = f"poligo-e2e-{suffix}@example.invalid"
    password = "PoligoE2E!" + uuid.uuid4().hex[:18]

    basic_java = """public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Poligo E2E");
    }
}"""

    main_java = """package app;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    static class Box<T> {
        private final T value;

        Box(T value) {
            this.value = value;
        }

        T get() {
            return value;
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.print("no-newline|");
        System.out.println("unicode=日本語🚀€");
        System.err.println("stderr-ok");

        List<Integer> values = List.of(1, 2, 3, 4);
        int sum = values.stream()
            .mapToInt(value -> value)
            .sum();

        if (sum != 10) {
            System.exit(20);
        }

        Box<String> box = new Box<>("generic-ok");

        if (!"generic-ok".equals(box.get())) {
            System.exit(21);
        }

        int[] numbers = {1, 2, 3};
        if (Arrays.stream(numbers).sum() != 6) {
            System.exit(22);
        }

        AtomicInteger counter = new AtomicInteger();

        Thread thread = new Thread(() -> counter.incrementAndGet());
        thread.start();
        thread.join();

        if (counter.get() != 1) {
            System.exit(23);
        }

        BufferedReader reader = new BufferedReader(
            new InputStreamReader(System.in, StandardCharsets.UTF_8)
        );
        String stdin = reader.readLine();

        if (!"日本語入力".equals(stdin)) {
            System.exit(24);
        }

        String env = System.getenv("E2E_VALUE");

        if (!"env-$(not-executed)".equals(env)) {
            System.exit(25);
        }

        String resource;

        try (var input = Main.class.getResourceAsStream("/config/message.txt")) {
            if (input == null) {
                System.exit(26);
                return;
            }

            resource = new String(
                input.readAllBytes(),
                StandardCharsets.UTF_8
            );
        }

        if (!"resource-ok".equals(resource)) {
            System.exit(27);
        }

        String fileContent;

        try {
            Path path = Path.of("e2e-temp.txt");
            Files.writeString(
                path,
                "filesystem-ok",
                StandardCharsets.UTF_8
            );
            fileContent = Files.readString(
                path,
                StandardCharsets.UTF_8
            );
            Files.deleteIfExists(path);
        } catch (Exception error) {
            System.exit(28);
            return;
        }

        if (!"filesystem-ok".equals(fileContent)) {
            System.exit(29);
        }

        if (!"helper-ok".equals(Helper.value())) {
            System.exit(30);
        }

        System.out.println("sum=" + sum);
        System.out.println("generic=" + box.get());
        System.out.println("thread=" + counter.get());
        System.out.println("stdin=" + stdin);
        System.out.println("env=" + env);
        System.out.println("resource=" + resource);
        System.out.println("file=" + fileContent);
        System.out.println("helper=" + Helper.value());
        System.out.println("args=" + String.join("|", args));
    }
}"""

    helper_java = """package app;

public class Helper {
    public static String value() {
        return "helper-ok";
    }
}"""

    foo_java = """package app;

public class Foo {
    public static void main(String[] args) {
        System.out.println("foo-entry-ok");
    }
}"""

    runtime_error_java = """package app;

public class Foo {
    public static void main(String[] args) {
        throw new RuntimeException("e2e-runtime-error");
    }
}"""

    exit_code_java = """package app;

public class Foo {
    public static void main(String[] args) {
        System.exit(7);
    }
}"""

    compile_error_java = """package app;

public class Foo {
    public static void main(String[] args) {
        this does not compile;
    }
}"""

    preview_syntax_java = """package app;

public class Foo {
    public static void main(String[] args) {
        int value = 1;
        String result = switch (value) {
            case 1 -> "one";
            default -> "other";
        };
        System.out.println(result);
    }
}"""

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True
        )
        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 1000
            }
        )

        try:
            print("E2E account:", email)

            page.goto(
                BASE_URL + "/createaccount",
                wait_until="domcontentloaded",
                timeout=60_000
            )

            page.get_by_label("表示名").fill("Poligo Production E2E")
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

            page.get_by_role(
                "button",
                name="新規プロジェクト"
            ).click()

            java_card = page.locator(
                ".stack-template-card"
            ).filter(
                has=page.get_by_text("Java", exact=True)
            ).first
            expect(java_card).to_be_visible(timeout=10_000)
            java_card.click()

            page.wait_for_url(
                "**/#/ide/*",
                timeout=60_000
            )

            expect(
                page.get_by_text("Main.java", exact=True).last
            ).to_be_visible(timeout=30_000)

            set_editor_value(page, basic_java)
            page.wait_for_timeout(1_000)
            open_debug(page)

            run_and_wait(page, "成功")
            wait_for_output(
                page,
                "Hello from Poligo E2E"
            )

            page.get_by_role(
                "button",
                name="ターミナル",
                exact=True
            ).click()

            terminal = page.locator(
                ".terminal:visible"
            )
            expect(terminal).to_be_visible(timeout=5_000)
            terminal.click()
            page.keyboard.type("日本語入力")
            page.keyboard.press("Enter")

            select_file(page, "Main.java")
            set_editor_value(page, main_java)
            create_file(page, "Helper.java", helper_java)
            create_file(page, ".env", "E2E_VALUE=env-$(not-executed)")
            create_file(page, "config/message.txt", "resource-ok")
            select_file(page, "Main.java")

            open_debug(page)

            page.get_by_label("実行引数").fill(
                'alpha "hello world" \'single quote\' "$(not-executed)"'
            )

            run_and_wait(page, "成功")

            for output in [
                "no-newline|unicode=日本語🚀€",
                "stderr-ok",
                "sum=10",
                "generic=generic-ok",
                "thread=1",
                "stdin=日本語入力",
                "env=env-$(not-executed)",
                "resource=resource-ok",
                "file=filesystem-ok",
                "helper=helper-ok",
                "args=alpha|hello world|single quote|$(not-executed)"
            ]:
                wait_for_output(page, output)

            create_file(page, "Foo.java", foo_java)
            select_file(page, "Foo.java")
            page.get_by_label("実行引数").fill("")
            run_and_wait(page, "成功")
            wait_for_output(page, "foo-entry-ok")

            set_editor_value(page, exit_code_java)
            run_and_wait(page, "失敗")
            expect(
                page.locator(".debug-panel")
            ).to_contain_text(
                "exit 7",
                timeout=5_000
            )

            set_editor_value(page, runtime_error_java)
            run_and_wait(page, "失敗")
            wait_for_output(page, "e2e-runtime-error")

            set_editor_value(page, compile_error_java)
            run_and_wait(page, "失敗")
            expect(
                page.locator(".debug-block-stderr pre").last
            ).to_be_visible(timeout=5_000)

            set_editor_value(page, preview_syntax_java)
            run_and_wait(page, "失敗")
            expect(
                page.locator(".debug-block-stderr pre").last
            ).to_be_visible(timeout=5_000)

            page.get_by_role(
                "button",
                name="サインアウト",
                exact=True
            ).click()

            page.wait_for_url(
                "**/signin",
                timeout=30_000
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
                page.get_by_text("Java", exact=True).first
            ).to_be_visible(timeout=30_000)

            actions = page.get_by_role(
                "button",
                name="Project actions for Java"
            )
            expect(actions).to_have_count(1, timeout=10_000)
            actions.click()

            page.locator('[role="menu"]').get_by_role(
                "button",
                name="プロジェクトを削除"
            ).click()

            confirm = page.get_by_role(
                "button",
                name="プロジェクトを削除"
            ).last
            expect(confirm).to_be_visible(timeout=5_000)
            confirm.click()

            expect(
                page.get_by_text("プロジェクトはまだありません")
            ).to_be_visible(timeout=30_000)

            print("PRODUCTION JAVA E2E: PASS")
        except Exception:
            page.screenshot(
                path="poligo-java-production-e2e-failure.png",
                full_page=True
            )
            print(
                "PRODUCTION JAVA E2E: FAIL"
            )
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    main()
