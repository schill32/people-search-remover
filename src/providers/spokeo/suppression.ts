import type { Page } from 'playwright';
import type { ProviderContext, SearchCandidate, SuppressionResult } from '../../types.js';
import { cleanSpokeoProfileUrl } from './search.js';

export async function submitSpokeoSuppression(
  candidateOrUrl: SearchCandidate | string,
  ctx: ProviderContext
): Promise<SuppressionResult> {
  const page: Page = ctx.page;
  const profileUrl = typeof candidateOrUrl === 'string' ? candidateOrUrl : candidateOrUrl.profileUrl;
  const cleanUrl = cleanSpokeoProfileUrl(profileUrl);
  const email =
    (typeof candidateOrUrl === 'object' ? candidateOrUrl.verificationEmail : undefined) ||
    ctx.config.verification.email;

  if (!email) {
    return {
      providerId: 'spokeo',
      recordId: cleanUrl,
      status: 'failed',
      message:
        'Spokeo requires a verification email in config.yaml under verification.email or person.verification_email',
    };
  }

  ctx.ui.info(`Navigating to Spokeo opt-out page...`);

  try {
    await page.goto('https://www.spokeo.com/optout', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Handle Cloudflare check if present
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      ctx.ui.warn('Cloudflare challenge detected. Please solve any captcha in the browser window...');
      await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    }

    // Step 1: Input URL
    ctx.ui.info(`Entering profile URL on Spokeo: ${cleanUrl}`);
    const urlInput = page.locator("input[name*='url'], input[placeholder*='URL'], input#url, input[type='url']").first();
    await urlInput.waitFor({ state: 'visible', timeout: 15000 });
    await urlInput.fill(cleanUrl);

    // Step 2: Input Email
    ctx.ui.info(`Entering confirmation email: ${email}`);
    const emailInput = page.locator("input[name*='email'], input[placeholder*='email'], input#email, input[type='email']").first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(email);

    // Step 3: Check agreement or solve captcha if any
    const agreementCheckbox = page.locator("input[type='checkbox']").first();
    if ((await agreementCheckbox.count()) > 0 && !(await agreementCheckbox.isChecked())) {
      await agreementCheckbox.check();
    }

    // Step 4: Click Opt-Out Button
    const submitBtn = page.locator(
      "button:has-text('Remove This Listing'), button:has-text('Opt Out'), button[type='submit'], input[type='submit']"
    ).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.click();

    // Step 5: Check response
    await page.waitForTimeout(3000);
    const bodyText = await page.innerText('body');

    if (bodyText.includes('verification link') || bodyText.includes('sent an email') || bodyText.includes('Check your email')) {
      ctx.ui.showEmailNotice(email, 'Spokeo');
      return {
        providerId: 'spokeo',
        recordId: cleanUrl,
        status: 'requires_action',
        message: `Opt-out requested. Verification email sent to ${email}.`,
        actionDetails: `Click confirmation link in email sent to ${email}`,
      };
    }

    // If captcha stopped it
    if (bodyText.includes('reCAPTCHA') || bodyText.includes('hCaptcha')) {
      ctx.ui.warn('CAPTCHA challenge encountered on Spokeo. Please solve it in the browser window.');
      await ctx.ui.waitForKeypress('Press [Enter] after solving the captcha in the browser window...');
    }

    ctx.ui.showEmailNotice(email, 'Spokeo');

    return {
      providerId: 'spokeo',
      recordId: cleanUrl,
      status: 'submitted',
      message: `Spokeo suppression submitted. Check ${email} for confirmation link.`,
      actionDetails: `Click confirmation link in email sent to ${email}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      providerId: 'spokeo',
      recordId: cleanUrl,
      status: 'failed',
      message: `Failed during Spokeo opt-out automation: ${errorMsg}`,
    };
  }
}
