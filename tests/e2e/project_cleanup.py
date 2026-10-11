from urllib.parse import quote


def cleanup_owned_projects(page, api_url, base_url, label):
    """Delete projects belonging to the currently authenticated E2E account."""
    cookies = page.context.cookies()
    cookie_header = "; ".join(
        cookie["name"] + "=" + cookie["value"]
        for cookie in cookies
    )
    if not cookie_header:
        print("CLEANUP SKIP: no authenticated cookies for " + label, flush=True)
        return

    headers = {"Cookie": cookie_header, "Origin": base_url.rstrip("/")}
    endpoint = api_url.rstrip("/") + "/api/projects"
    try:
        response = page.request.get(endpoint, headers=headers, timeout=15_000)
        if not 200 <= response.status < 300:
            print(
                "CLEANUP WARNING: could not list projects for " + label +
                " (HTTP " + str(response.status) + ")", flush=True
            )
            return

        projects = response.json()
        if not isinstance(projects, list):
            print("CLEANUP WARNING: unexpected project list for " + label, flush=True)
            return

        deleted = 0
        for project in projects:
            project_id = project.get("id") if isinstance(project, dict) else None
            if not isinstance(project_id, str) or not project_id:
                continue
            result = page.request.delete(
                endpoint + "/" + quote(project_id, safe=""),
                headers=headers,
                timeout=15_000
            )
            if result.status in (200, 204):
                deleted += 1
            elif result.status != 404:
                print(
                    "CLEANUP WARNING: could not delete an owned project for " +
                    label + " (HTTP " + str(result.status) + ")",
                    flush=True
                )

        print(
            "E2E PROJECT CLEANUP: " + label + " deleted=" + str(deleted),
            flush=True
        )
    except Exception as error:
        print(
            "CLEANUP WARNING: project cleanup failed for " + label + ": " +
            str(error),
            flush=True
        )
