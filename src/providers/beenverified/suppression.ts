import type { Page } from 'playwright';
import type { ProviderContext, SearchCandidate, SuppressionResult } from '../../types.js';

export async function submitBeenVerifiedSuppression(
  candidate: SearchCandidate,
  ctx: ProviderContext
): Promise<SuppressionResult> {
  const page: Page = ctx.page;
  const email = candidate.verificationEmail || ctx.config.verification.email;

  if (!email) {
    return {
      providerId: 'beenverified',
      recordId: candidate.id,
      status: 'failed',
      message:
        'BeenVerified requires a verification email in config.yaml under verification.email or person.verification_email',
    };
  }

  ctx.ui.info(`Navigating to BeenVerified opt-out for ${candidate.name}...`);

  try {
    // If the candidate URL is a direct submit URL, navigate there, else click opt out on the active search page
    if (candidate.profileUrl && candidate.profileUrl.startsWith('http')) {
      await page.goto(candidate.profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    // Check for Cloudflare / Turnstile
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      ctx.ui.warn('Cloudflare challenge detected. Please solve any captcha in the browser window...');
      await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    }

    // Check if an Opt-Out button needs to be clicked first
    const optOutBtn = page.locator(
      `button[data-id='${candidate.metadata?.recordId || candidate.id}'], button:has-text('Opt Out'), a:has-text('Opt Out')`
    ).first();

    if ((await optOutBtn.count()) > 0 && (await optOutBtn.isVisible())) {
      await optOutBtn.click();
      await page.waitForTimeout(1500);
    }

    // Step 1: Input Email address
    ctx.ui.info(`Entering verification email: ${email}`);
    const emailInput = page.locator("input[name*='email'], input[type='email'], input[placeholder*='email']").first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(email);

    // Step 2: Check any acknowledgement checkbox if present
    const checkbox = page.locator("input[type='checkbox']").first();
    if ((await checkbox.count()) > 0 && !(await checkbox.isChecked())) {
      await checkbox.check();
    }

    // Step 3: Click Send Verification Email
    const sendBtn = page.locator(
      "button:has-text('Send Verification Email'), button:has-text('Verify'), button:has-text('Submit'), button[type='submit']"
    ).first();
    await sendBtn.waitFor({ state: 'visible', timeout: 10000 });
    await sendBtn.click();

    // Step 4: Verify email confirmation sent
    await page.waitForTimeout(3000);
    const bodyText = await page.innerText('body');

    if (bodyText.includes('Verification Email Sent') || bodyText.includes('check your email') || bodyText.includes('verification link')) {
      ctx.ui.showEmailNotice(email, 'BeenVerified');
      return {
        providerId: 'beenverified',
        recordId: candidate.id,
        status: 'requires_action',
        message: `Opt-out requested. Verification link sent to ${email}.`,
        actionDetails: `Click confirmation link in email sent to ${email}`,
      };
    }

    // Captcha fallback
    if (bodyText.includes('CAPTCHA') || bodyText.includes('captcha')) {
      ctx.ui.warn('CAPTCHA detected on BeenVerified. Please solve it in the browser window.');
      await ctx.ui.waitForKeypress('Press [Enter] after solving the captcha in the browser window...');
    }

    ctx.ui.showEmailNotice(email, 'BeenVerified');

    return {
      providerId: 'beenverified',
      recordId: candidate.id,
      status: 'submitted',
      message: `BeenVerified opt-out submitted. Check ${email} for confirmation link.`,
      actionDetails: `Click confirmation link in email sent to ${email}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      providerId: 'beenverified',
      recordId: candidate.id,
      status: 'failed',
      message: `Failed during BeenVerified opt-out automation: ${errorMsg}`,
    };
  }
}
