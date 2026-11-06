import type { Page } from 'playwright';
import type { ProviderContext, SuppressionResult } from '../../types.js';
import { cleanWhitepagesProfileUrl } from './search.js';

export async function submitWhitepagesSuppression(
  profileUrl: string,
  ctx: ProviderContext
): Promise<SuppressionResult> {
  const page: Page = ctx.page;
  const cleanUrl = cleanWhitepagesProfileUrl(profileUrl);
  const phone = ctx.config.verification.phone;

  if (!phone) {
    return {
      providerId: 'whitepages',
      recordId: cleanUrl,
      status: 'failed',
      message: 'Whitepages requires a verification phone number in config.yaml under verification.phone',
    };
  }

  ctx.ui.info(`Navigating to Whitepages suppression portal...`);

  try {
    await page.goto('https://www.whitepages.com/suppression-requests', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check for Cloudflare / Turnstile challenge
    const cfTitle = await page.title();
    if (cfTitle.includes('Just a moment') || cfTitle.includes('Attention Required')) {
      ctx.ui.warn('Cloudflare challenge detected. Please complete the captcha in the open browser window...');
      await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    }

    // Step 1: Input profile URL
    ctx.ui.info(`Submitting profile URL: ${cleanUrl}`);
    const urlInput = page.locator("input[type='url'], input[name*='url'], input[placeholder*='URL'], input#url").first();
    await urlInput.waitFor({ state: 'visible', timeout: 15000 });
    await urlInput.fill(cleanUrl);

    // Click Next
    const nextBtn = page.locator("button:has-text('Next'), button[type='submit'], input[value='Next']").first();
    await nextBtn.click();

    // Step 2: Confirm profile ('Remove Me')
    ctx.ui.info(`Confirming profile removal...`);
    const removeBtn = page.locator("button:has-text('Remove Me'), input[value='Remove Me'], a:has-text('Remove Me')").first();
    await removeBtn.waitFor({ state: 'visible', timeout: 20000 });
    await removeBtn.click();

    // Step 3: Select reason
    const reasonSelect = page.locator("select[name*='reason'], select").first();
    const hasSelect = (await reasonSelect.count()) > 0;
    if (hasSelect) {
      // Pick custom reason or default first non-empty option
      try {
        await reasonSelect.selectOption({ label: ctx.config.opt_out_reason });
      } catch {
        await reasonSelect.selectOption({ index: 1 });
      }

      // If there's an intermediate "Next" button after reason
      const reasonNextBtn = page.locator("button:has-text('Next'), button:has-text('Continue')").first();
      if ((await reasonNextBtn.count()) > 0 && (await reasonNextBtn.isVisible())) {
        await reasonNextBtn.click();
      }
    }

    // Step 4: Phone verification
    ctx.ui.info(`Entering verification phone number: ${phone}`);
    const phoneInput = page.locator("input[type='tel'], input[name*='phone']").first();
    await phoneInput.waitFor({ state: 'visible', timeout: 15000 });
    await phoneInput.fill(phone);

    // Check agreement checkbox if present
    const checkbox = page.locator("input[type='checkbox']").first();
    if ((await checkbox.count()) > 0) {
      await checkbox.check();
    }

    // Trigger call
    const callBtn = page.locator(
      "button:has-text('Call now to verify'), button:has-text('Verify'), input[value*='verify'], button[type='submit']"
    ).first();
    await callBtn.click();

    // Step 5: Extract 4-digit code from DOM
    ctx.ui.info(`Waiting for verification call PIN from Whitepages...`);
    let pinCode = '';

    try {
      // Wait for PIN element or text container to appear
      await page.waitForTimeout(2000);
      const pinElement = page.locator(
        "[class*='code'], [class*='pin'], [id*='code'], [id*='pin'], h2, strong, span.code"
      );

      const allTexts = await pinElement.allInnerTexts();
      for (const t of allTexts) {
        const match = t.trim().match(/\b(\d{4})\b/);
        if (match) {
          pinCode = match[1];
          break;
        }
      }

      // If still not found, check entire body text
      if (!pinCode) {
        const bodyText = await page.innerText('body');
        const match = bodyText.match(/(?:code|pin|verification)\s*(?:is)?\s*:?\s*(\d{4})/i) || bodyText.match(/\b(\d{4})\b/);
        if (match) {
          pinCode = match[1];
        }
      }
    } catch {
      // Non-fatal if scraper missed it; user can view browser window
    }

    if (pinCode) {
      ctx.ui.showPin(pinCode, 'Whitepages');
    } else {
      ctx.ui.warn('Could not automatically scrape the PIN text. Please check the open browser window for the 4-digit code!');
    }

    // Step 6: Wait for call completion
    ctx.ui.info('Waiting for phone call to complete...');
    
    // Check if page automatically navigates or displays success confirmation
    const successPromise = page.waitForSelector(
      ":has-text('request has been accepted'), :has-text('successfully removed'), :has-text('suppression request has been received')",
      { timeout: 45000 }
    ).then(() => true).catch(() => false);

    const manualFallback = ctx.ui.waitForKeypress(
      'Press [Enter] once you have answered the phone and keyed in the PIN...'
    );

    await Promise.race([successPromise, manualFallback]);

    // Check if error message appeared on page (e.g. phone rejected or rate limited)
    const pageText = await page.innerText('body');
    if (pageText.includes('Too many suppression requests') || pageText.includes('rejected')) {
      return {
        providerId: 'whitepages',
        recordId: cleanUrl,
        status: 'failed',
        message: 'Whitepages rejected the suppression request (rate limit or phone restriction).',
      };
    }

    return {
      providerId: 'whitepages',
      recordId: cleanUrl,
      status: 'submitted',
      message: 'Suppression request submitted successfully to Whitepages.',
      actionDetails: pinCode ? `Verified via phone PIN: ${pinCode}` : 'Phone verification call completed',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      providerId: 'whitepages',
      recordId: cleanUrl,
      status: 'failed',
      message: `Failed during Whitepages suppression automation: ${errorMsg}`,
    };
  }
}
