# Security overview

This project treats runtime execution and file access as sensitive behavior. This document describes what is checked today, what is not, and the assumptions behind those checks.

## What `npm run check` covers

`npm run check` runs type-check, runtime validation, tests, build, runtime status, and security smoke tests.

`npm run security:smoke` specifically covers current assertions around command/cwd validation, package sanitizer behavior, unknown package ID rejection, workspace path containment checks, manifest validation, and runtime-state behavior. It is a focused regression suite for server-side safety assumptions, not a full penetration test.

## What it does not cover

## Known limitations

* API authentication: endpoint protection is opt-in via `TERMINAI_API_KEY`; the issue intent is addressed, but enforcement is conditional on configuration.
* browser-based auth flows/token handling: none
* HTTPS/TLS enforcement: none
* rate limiting or brute-force defenses: none
* full OS-level privilege isolation: not implemented
* exhaustive AI route abuse scenarios: not covered
* native Android permission surface: basic/generic
* external dependency vulnerability scanning: not included

## Local development assumptions

Assume the server is local-only unless `TERMINAI_BIND_ADDRESS` is intentionally changed. Keep `TERMINAI_WORKSPACE_ROOT` pointed at a project-specific directory. Do not run the server as root.

## Reporting

Do not open public issues for exploitable vulnerabilities. Report them privately so they don’t become pre-disclosed.
