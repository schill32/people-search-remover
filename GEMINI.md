# Project Instructions — people-search-remover

## Core Mandate: Keep `AGENTS.md` Up to Date

Whenever you make changes to this codebase—such as:
* Adding or modifying data broker providers
* Updating configuration schemas (`AppConfigSchema`, `PersonSchema`, etc.)
* Introducing new CLI commands, flags, or npm scripts
* Altering suppression or verification flows

You **MUST** update `AGENTS.md` to reflect those changes before concluding your task. Ensure provider tables, architecture maps, and command lists remain accurate and synchronized with the codebase.

---

## Workspace Standards

* **Credentials & Privacy**: Never log, print, or commit `config.yaml`, `state.json`, phone numbers, or email addresses.
* **Anti-Bot Navigation**: Retain `browser.headless: false` in default configurations to bypass Cloudflare and bot protections.
* **Testing & Integrity**: Run `npm test` and `npm run build` after making code changes. Always update or add tests when changing provider or schema behavior.
