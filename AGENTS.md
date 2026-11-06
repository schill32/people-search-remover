# AGENTS.md — Agent & Developer Context

This document maintains architectural context, provider workflows, and engineering standards for autonomous agents and contributors working on `people-search-remover`.

---

## 1. Project Overview & Intent

`people-search-remover` is an interactive Node.js / TypeScript CLI tool powered by Playwright to search for family members across major public people search engines (data brokers), review matching candidate profiles, and automate suppression / opt-out submissions.

### Core Philosophy
* **Safety & Consent First**: Never submit suppression requests without explicit interactive user confirmation (unless running direct URL suppression).
* **Anti-Bot Navigation**: Uses headed Chromium with stealth args (`--disable-blink-features=AutomationControlled`, masked `navigator.webdriver`, realistic user-agents) to navigate Cloudflare and provider anti-scraping defenses without paid proxy APIs.
* **Auditability**: All discovery, submission timestamps, and verification statuses are locally persisted in `state.json`.

---

## 2. Architecture & File Structure

```
people-search-remover/
├── src/
│   ├── index.ts               # CLI entrypoint (Commander.js), 3-phase pipeline orchestration
│   ├── types.ts               # Zod validation schemas & core TypeScript interfaces
│   ├── config.ts              # YAML config loader and validator
│   ├── browser.ts             # Playwright browser lifecycle & stealth context setup
│   ├── state.ts               # StateManager: loads/persists state.json
│   ├── location.ts            # Canonical US city/state matcher (isLocationMatch)
│   ├── ui.ts                  # CLI tables, inquirer multi-select, PIN/email banners
│   └── providers/
│       ├── base.ts            # BaseProvider abstract class
│       ├── registry.ts        # ProviderRegistry (discovery & enabled filter)
│       ├── whitepages/        # Phone verification automated suppression
│       ├── spokeo/            # Email confirmation, name + reverse email lookup
│       ├── truepeoplesearch/  # Removal portal session + "Remove This Record" flow
│       ├── beenverified/      # Opt-out portal suppression
│       └── peopleconnect/     # Shared backend for TruthFinder & Intelius
├── test/                      # Vitest test suite (isolated unit tests)
├── config.example.yaml        # Template configuration
├── state.json                 # Local suppression tracking (gitignored)
└── package.json               # Scripts and dependencies
```

---

## 3. Data Broker Providers & Flows

| Provider ID | Provider Name | Verification Type | Suppression Mechanism |
| :--- | :--- | :--- | :--- |
| `whitepages` | Whitepages | `phone` | Submits URL to `whitepages.com/suppression-requests`, triggers phone call, scrapes 4-digit PIN to terminal, waits for call completion. |
| `spokeo` | Spokeo | `email` | Submits URL and verification email to `spokeo.com/optout`. Also supports reverse email searches via `spokeo.com/email-search`. |
| `truepeoplesearch` | TruePeopleSearch | `email` | Initiates session at `truepeoplesearch.com/removal`, navigates to profile URL, clicks `"Remove This Record"`, and prompts for email confirmation. |
| `truthfinder` | TruthFinder | `email` | Uses PeopleConnect portal (`suppression.peopleconnect.us`) to trigger verification magic link covering TruthFinder and Intelius. |
| `intelius` | Intelius | `email` | Same PeopleConnect shared backend as TruthFinder. |
| `beenverified` | BeenVerified | `email` | Navigates to `beenverified.com/svc/optout`, clicks opt-out, submits email for confirmation link. |

---

## 4. Key Workflows & Features

### 3-Phase Interactive Pipeline (`src/index.ts`)
1. **Phase 1: Search & Discovery**:
   - Iterates through `config.people` -> `person.locations` -> `enabledProviders`.
   - Executes `provider.search()`.
   - Filters candidate records using `isLocationMatch(candidate.locations, loc.city, loc.state)` to reject nationwide/statewide fallbacks.
   - Skips records already marked as submitted/verified in `state.json`.
2. **Phase 2: Candidate Review**:
   - Formats discovered candidates into a CLI table (`cli-table3`).
   - If `--dry-run` is passed, halts here without submitting.
   - Prompts user via `@inquirer/prompts` checkbox to select profiles to suppress.
3. **Phase 3: Suppression Execution**:
   - Executes `provider.suppress(candidate, ctx)` sequentially.
   - Prompts for phone PIN or displays verification email notice.
   - Updates `state.json` with timestamp and status (`submitted`, `requires_action`, or `verified`).

### Location Filtering (`src/location.ts`)
* People search engines often return out-of-location profiles (nationwide fallbacks or neighboring cities).
* `isLocationMatch()` matches both 2-letter state abbreviations (`IL`) and full state names (`Illinois`), collapses whitespace/punctuation, and strictly requires city match.

### Per-Person Email Routing (`src/types.ts`)
* `person.emails`: Array of known personal/work emails used for reverse lookup (e.g., Spokeo).
* `person.verification_email`: Specific inbox to route opt-out confirmation links for that person (falls back to global `verification.email`).

---

## 5. Development & Debugging Tools

### Available Scripts
```bash
npm start                       # Full interactive pipeline
npm run dry-run                 # Scan & review only (no opt-outs submitted)
npm run search                  # Alias for search dry-run
npm run status                  # Display tracked suppression records table
npm run providers               # List registered providers
npm run suppress -- <id> <url>  # Directly suppress a specific known URL
npm run build                   # Compile TypeScript via tsc
npm test                        # Run Vitest test suite
npm run install:browsers        # Install Playwright Chromium binary
```

### Debugging with Breakpoints
1. **Playwright Inspector GUI**:
   Run with `PWDEBUG=1 npm start -- --provider <id>` to step through page actions.
2. **Programmatic Pause**:
   Insert `await page.pause()` in any provider to halt execution and open Playwright Inspector.
3. **IDE Debugger (IntelliJ / WebStorm / VS Code)**:
   - `npm run debug -- --provider <id>` (runs with `tsx --inspect`)
   - `npm run debug:wait -- --provider <id>` (halts on line 1 waiting for IDE attach)
   - Attach debugger to `localhost:9229`.

---

## 6. Coding & Contribution Conventions

1. **Security & Secrets**: Never log, print, or commit `config.yaml`, `state.json`, phone numbers, or email addresses.
2. **No Regression Rule**: Always run `npm test` and `npm run build` before wrapping up.
3. **Resilient Selectors**: When targeting broker DOM elements, use multi-selector fallbacks (`page.locator("button:has-text('Submit'), #btnSubmit, input[type='submit']")`) because brokers frequently test UI variations.
4. **Humanized Delays**: Always use `this.randomDelay(800, 2000)` between page navigations to avoid triggering bot defense thresholds.
5. **Living Context (`AGENTS.md` Maintenance Rule)**: Any agent or engineer making modifications to providers, configuration schemas, CLI commands, or architecture **MUST** update this `AGENTS.md` file in the same task/commit to ensure project context never drifts out of date.
