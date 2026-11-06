# People Search Remover

After a family member was being harassed by someone using people finder websites, I started to create this tool to automate the suppression/opt-out process.  A tool even with the best intentions can still can manipulated for bad.

A modular, interactive TypeScript command-line utility powered by Playwright to search for family members across the top 5 public people search engines / data brokers, review matching profiles, and automate suppression/opt-out requests.

## Supported Providers

| Provider | Network | Verification Method | Suppression Flow |
| :--- | :--- | :--- | :--- |
| **Whitepages** | Whitepages Inc. | **Phone Call (4-digit PIN)** | Form at `whitepages.com/suppression-requests` |
| **Spokeo** | Spokeo Inc. | **Email Confirmation Link** | Form at `spokeo.com/optout` |
| **TruePeopleSearch** | TruePeopleSearch | **Email Confirmation Link** | Portal at `truepeoplesearch.com/removal` |
| **TruthFinder** | PeopleConnect | **Email Confirmation Link** | Central portal at `suppression.peopleconnect.us` |
| **Intelius** | PeopleConnect | **Email Confirmation Link** | Central portal at `suppression.peopleconnect.us` |
| **BeenVerified** | Lifetime Value Co. | **Email Confirmation Link** | Opt-out portal at `beenverified.com/svc/optout` |

*Note: TruthFinder and Intelius share the PeopleConnect backend. Suppressing a profile via PeopleConnect applies suppression rules across TruthFinder, Intelius, Instant Checkmate, and US Search.*

---

## Prerequisites

- **Node.js**: v18 or higher
- **Chromium**: Managed automatically by Playwright (`npx playwright install chromium`)

---

## Installation & Quick Start

1. **Install dependencies and Playwright Chromium:**
   ```bash
   npm install
   npm run install:browsers
   ```

2. **Create your configuration file:**
   ```bash
   cp config.example.yaml config.yaml
   ```

3. **Configure your family members and contact info in `config.yaml`:**
   ```yaml
   verification:
     # Real phone number to receive the automated Whitepages verification call
     phone: "555-123-4567"
     # Email to receive opt-out confirmation links (Spokeo, BeenVerified, TruePeopleSearch, TruthFinder, Intelius)
     email: "your-privacy-email@example.com"

   browser:
     headless: false # Recommended false to bypass Cloudflare bot detection
     slow_mo_ms: 100

   enabled_providers:
     - whitepages
     - spokeo
     - truepeoplesearch
     - truthfinder
     - intelius
     - beenverified

   opt_out_reason: "I just want to keep my information private"

   people:
     - name: "Jane Doe"
       dob: "1980-05-15" # Optional: assists PeopleConnect (TruthFinder/Intelius) matching
       locations:
         - city: "Austin"
           state: "TX"
         - city: "Seattle"
           state: "WA"
       aliases:
         - "Jane M Doe"
       # Optional: Known email addresses used for reverse email lookup (e.g. Spokeo)
       emails:
         - "jane.doe@example.com"
       # Optional: Per-person verification email override for confirmation links
       verification_email: "jane-optout@privacy-alias.com"
     - name: "John Doe"
       locations:
         - city: "Austin"
           state: "TX"
   ```

---

## CLI Usage

### 1. Interactive Pipeline (Recommended)
Runs the full interactive pipeline: searches configured family members across all enabled providers, presents a candidate checklist to select matching profiles, and executes suppression requests one by one:
```bash
npm start
```

### 2. Dry Run (Search & Review Only)
Scans all providers and displays discovered profiles in a terminal table without submitting any opt-out forms:
```bash
npm run dry-run
# or
npm run search
```

### 3. Run for a Specific Provider Only
Target a single provider by ID:
```bash
npm start -- --provider whitepages
npm start -- --provider spokeo
```

### 4. Direct URL Suppression
Submit a specific known profile URL directly without scanning:
```bash
npm run suppress -- whitepages "https://www.whitepages.com/name/Jane-Doe/Austin-TX/PX3vBjnODk3"
npm run suppress -- spokeo "https://www.spokeo.com/Jane-Doe/TX/Austin/p12345"
```

### 5. View Tracked Records & Audit Status
Inspect all previously discovered, submitted, and verified records stored in `state.json`:
```bash
npm run status
```

### 6. List Supported Providers
```bash
npm run providers
```

---

## How Verification Works

### Whitepages (Automated Phone Verification)
1. The tool submits the profile URL to `whitepages.com/suppression-requests`.
2. Whitepages triggers an automated phone call to your `verification.phone`.
3. The tool scrapes the 4-digit verification code from the web page and highlights it in a bold terminal banner:
   ```
   ┌────────────────────────────────────────────────────────────┐
   │  An automated call from Whitepages is dialing your phone.  │
   │  Answer and enter this 4-digit PIN on your phone keypad:   │
   │                                                            │
   │                      [  5 8 2 1  ]                         │
   └────────────────────────────────────────────────────────────┘
   ```
4. You answer the call and key in the PIN. The tool detects call completion and records the submission in `state.json`.

### Spokeo, BeenVerified, TruePeopleSearch, TruthFinder & Intelius (Email Verification)
1. The tool navigates to the respective opt-out page, selects your record, and submits your `verification.email`.
2. A terminal banner notifies you that a verification email was dispatched.
3. Simply open your inbox and click the verification link in the email to activate the suppression rule.

---

## Audit & State Tracking (`state.json`)

All search results, submission timestamps, and verification statuses are locally tracked in `state.json`.
- Already submitted or verified records are automatically skipped during subsequent runs so you don't submit duplicate requests.
- Because data brokers periodically re-ingest county records, re-running the tool every 3 to 6 months verifies whether new profiles have emerged.

---

## Debugging & Breakpoints

If an automation step or form interaction (such as a CAPTCHA or custom checkbox) needs inspection or troubleshooting:

### 1. Programmatic Breakpoint (`page.pause()`)
Insert `await page.pause()` directly into any provider method (e.g. before form interaction in `src/providers/peopleconnect/client.ts`):
```typescript
await page.pause(); // Halts execution and opens Playwright Inspector GUI
```
Playwright halts execution, keeps the browser open, and launches the Inspector toolbar where you can view DOM selectors, test clicks, and hit **Resume (`F8`)** or **Step Over (`F10`)**.

### 2. Playwright Inspector Mode (`PWDEBUG=1`)
Step through any provider run using the Inspector GUI without changing code:
```bash
PWDEBUG=1 npm start -- --provider truthfinder
```

### 3. IDE Debugger (IntelliJ / WebStorm / VS Code)
Attach your IDE debugger directly to TypeScript source code using standard breakpoints:
```bash
# Start with Node inspector listening on port 9229
npm run debug -- --provider truthfinder

# Or halt on line 1 until your IDE debugger attaches
npm run debug:wait -- --provider truthfinder
```

#### Attaching from IntelliJ / WebStorm:
1. Go to **Run > Edit Configurations...**
2. Click **`+`** and choose **Attach to Node.js/Chrome**.
3. Keep default port `9229` and click **OK**.
4. Set breakpoints in your TypeScript files and click **Debug** on the configuration.

---

## Adding New Providers (Extensibility Guide)

To add another data broker (e.g., Radaris, FastPeopleSearch):
1. Create a new directory under `src/providers/<provider-name>/`.
2. Implement a class extending `BaseProvider` with:
   - `id`: unique string identifier
   - `name`: display name
   - `verificationType`: `'phone' | 'email' | 'none'`
   - `search(person, location, ctx)`: returns `SearchCandidate[]`
   - `suppress(candidate, ctx)`: returns `SuppressionResult`
3. Register the provider in `src/index.ts` via `registry.register(new MyProvider())`.
