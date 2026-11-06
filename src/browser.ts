import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { AppConfig } from './types.js';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let activeBrowser: Browser | null = null;

// Gracefully close active browser on SIGINT / SIGTERM
function setupProcessSignalHandlers() {
  const handler = async () => {
    if (activeBrowser) {
      try {
        await activeBrowser.close();
      } catch {
        // Ignore errors during emergency exit
      }
    }
    process.exit(130);
  };

  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
}

setupProcessSignalHandlers();

export async function launchBrowser(config: AppConfig): Promise<BrowserSession> {
  const isHeadless = config.browser.headless ?? false;
  const slowMo = config.browser.slow_mo_ms ?? 100;

  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
    ],
  });

  activeBrowser = browser;

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Mask navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  const page = await context.newPage();

  const close = async () => {
    try {
      await context.close();
      await browser.close();
      if (activeBrowser === browser) {
        activeBrowser = null;
      }
    } catch {
      // Ignore errors on close
    }
  };

  return { browser, context, page, close };
}
