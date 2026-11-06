import type { Page } from 'playwright';
import type { ProviderContext, SearchCandidate, SuppressionResult } from '../../types.js';
import { cleanTruePeopleSearchProfileUrl } from './search.js';

/**
 * Automates the TruePeopleSearch record removal request flow.
 * Steps:
 *  1. Navigates to https://www.truepeoplesearch.com/removal
 *  2. Fills verification email and checks agreement
 *  3. Submits initial removal authorization
 *  4. Navigates to candidate profile URL
 *  5. Locates and clicks "Remove This Record"
 *  6. Prompts user to check inbox for verification email within 24h
 */
export async function submitTruePeopleSearchSuppression(
  candidate: SearchCandidate,
  ctx: ProviderContext
): Promise<SuppressionResult> {
  const page: Page = ctx.page;
  const cleanUrl = cleanTruePeopleSearchProfileUrl(candidate.profileUrl);
  const email = ctx.config.verification.email;

  if (!email) {
    return {
      providerId: 'truepeoplesearch',
      recordId: cleanUrl,
      status: 'failed',
      message: 'TruePeopleSearch requires a verification email in config.yaml under verification.email',
    };
  }

  ctx.ui.info(`Navigating to TruePeopleSearch removal portal...`);

  try {
    // Step 1: Navigate to the removal page
    await page.goto('https://www.truepeoplesearch.com/removal', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check for Cloudflare / Turnstile challenges
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      ctx.ui.warn('Cloudflare challenge detected. Please solve any captcha in the browser window...');
      await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    }

    // Step 2: Fill email address
    ctx.ui.info(`Entering verification email: ${email}`);
    const emailInput = page.locator("input[type='email'], input#Email, input[name*='Email' i]").first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(email);

    // --- DEBUG BREAKPOINT ---
    // Pauses execution and opens Playwright Inspector to inspect the terms checkbox & DOM
    await page.pause();

    // Step 3: Check terms agreement checkbox
    const termsCheckbox = page.locator("input[type='checkbox'], #chkTerms, input[id*='terms' i]").first();
    if ((await termsCheckbox.count()) > 0 && !(await termsCheckbox.isChecked())) {
      try {
        await termsCheckbox.check();
      } catch {
        await termsCheckbox.check({ force: true }).catch(async () => {
          const label = page.locator("label:has(input[type='checkbox']), label[for*='terms' i]").first();
          if ((await label.count()) > 0) {
            await label.click();
          }
        });
      }
    }

    // Step 4: Check for CAPTCHA challenge if present
    const captchaFrame = page.locator(
      "iframe[src*='turnstile'], iframe[src*='recaptcha'], iframe[src*='hcaptcha'], div.cf-turnstile"
    ).first();

    if ((await captchaFrame.count()) > 0) {
      ctx.ui.warn('CAPTCHA challenge detected on TruePeopleSearch removal page. Please complete it in the browser window.');
      await ctx.ui.waitForKeypress('Press [Enter] after completing the CAPTCHA in the browser window...');
    }

    // Step 5: Click submit button on removal page
    const submitBtn = page.locator(
      "#btnSubmit, button:has-text('Begin Removal'), button:has-text('Send Request'), button[type='submit'], input[type='submit']"
    ).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // Step 6: Navigate to candidate profile page within active removal session
    ctx.ui.info(`Navigating to candidate profile: ${cleanUrl}`);
    await page.goto(cleanUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Scroll to bottom to reveal "Remove This Record" button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const removeBtn = page.locator(
      "button:has-text('Remove This Record'), a:has-text('Remove This Record'), #btnRemoveRecord, .btn-remove-record, a.btn-danger, button.btn-danger"
    ).first();

    const hasRemoveBtn = (await removeBtn.count()) > 0;
    if (hasRemoveBtn) {
      await removeBtn.scrollIntoViewIfNeeded().catch(() => {});
      await removeBtn.click();
      await page.waitForTimeout(3000);
    } else {
      // Fallback if button is styled or rendered differently
      const bodyText = await page.innerText('body');
      if (
        !bodyText.toLowerCase().includes('remove this record') &&
        !bodyText.toLowerCase().includes('email has been sent') &&
        !bodyText.toLowerCase().includes('verification link')
      ) {
        ctx.ui.warn('Could not automatically click "Remove This Record". Please inspect the open browser window.');
        await ctx.ui.waitForKeypress('Press [Enter] after clicking "Remove This Record" if visible...');
      }
    }

    // Step 7: Display verification notice
    ctx.ui.showEmailNotice(email, 'TruePeopleSearch');

    return {
      providerId: 'truepeoplesearch',
      recordId: cleanUrl,
      status: 'submitted',
      message: `TruePeopleSearch removal request submitted. Please check ${email} and click the confirmation link within 24 hours.`,
      actionDetails: `Click confirmation link in email sent to ${email}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      providerId: 'truepeoplesearch',
      recordId: cleanUrl,
      status: 'failed',
      message: `Failed during TruePeopleSearch suppression automation: ${errorMsg}`,
    };
  }
}
