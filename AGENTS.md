# Repository Guidelines

## Project Structure & Module Organization

This repository hosts Dualbro, a static browser entry point for webOS rooting tools.

- Root `index.html` redirects visitors; `CNAME` configures the hosted domain.
- `getroot/index.html`, `dualbro.js`, and `guided-terminal.css` contain the main interface, connection logic, and styling.
- `getroot/wtfbro/index.html` provides the WTFBro interface; `payload/` contains its JavaScript service, metadata, and device shell script.
- `getroot/offline/` contains setup instructions, Windows screenshots, a demo video, and `setup.sh`.
- `getroot/_config.yml` configures Jekyll; `getroot/offline.json` selects offline behavior.
- `tests/security.test.cjs` covers local routing, download integrity, and Telnet safeguards.

## Build, Test, and Development Commands

There is no application build step or dependency installation workflow. The payload's `package.json` is service metadata, with no npm scripts.

- `python3 -m http.server 50000 --bind 127.0.0.1`: serve the repository; open `http://127.0.0.1:50000/getroot/`. Use HTTP because the interface blocks `file:` loading.
- `node --check getroot/dualbro.js` and `node --check getroot/wtfbro/payload/exploit.js`: check JavaScript syntax without execution.
- `sh -n getroot/offline/setup.sh` and `sh -n getroot/wtfbro/payload/wtfbro.sh`: check shell syntax without execution.
- `sh getroot/offline/setup.sh`: start the interactive offline workflow. It requires curl and Python 3, downloads missing payload binaries, rewrites `offline.json`, and serves on port 50000.

## Coding Style & Naming Conventions

Follow nearby code: two-space indentation in main JavaScript/CSS, camelCase functions and variables, PascalCase classes, and UPPER_SNAKE_CASE constants. Shell files use `#!/bin/sh`; preserve webOS compatibility. No formatter or linter configuration is checked in. Avoid unrelated reformatting, new frameworks, and speculative abstractions.

## Testing Guidelines

Run `node --test tests/security.test.cjs` for the Node.js regression suite, plus relevant syntax checks. No coverage threshold is configured. Manually verify changed controls, dialogs, links, and layout. Device checks require separate authorization; record the webOS version and distinguish desktop checks from device validation.

## Commit & Pull Request Guidelines

History uses short, informal subjects such as `fix typo`; no enforced prefix convention is evident. Use concise, descriptive imperative subjects. PRs should explain the change, list validation and device limitations, link relevant issues, and include screenshots for UI changes.

## Configuration & Device Safety

Keep local IP addresses and downloaded `hbc.ipk`/`telnetd` files out of commits. Use syntax checks for routine validation; payload execution modifies the target device and belongs on authorized test hardware.
