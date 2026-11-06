import type { Page } from 'playwright';
import type { Location, Person, ProviderContext, SearchCandidate, SuppressionResult } from '../../types.js';

export const PEOPLECONNECT_PORTAL_URL = 'https://suppression.peopleconnect.us';

export class PeopleConnectClient {
  /**
   * Initiates the PeopleConnect suppression portal login flow by submitting the user's email.
   */
  public static async requestEmailSession(
    page: Page,
    email: string,
    ctx: ProviderContext
  ): Promise<boolean> {
    ctx.ui.info(`Connecting to PeopleConnect Suppression Center at ${PEOPLECONNECT_PORTAL_URL}...`);

    await page.goto(PEOPLECONNECT_PORTAL_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check Cloudflare
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      ctx.ui.warn('Cloudflare challenge detected. Please solve any captcha in the browser window...');
      await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    }

    // Input email
    const emailInput = page.locator("input[type='email'], input[name*='email'], input[placeholder*='email']").first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(email);

    // --- DEBUG BREAKPOINT ---
    // Pauses execution and opens the Playwright Inspector GUI to inspect the checkbox & DOM
    await page.pause();

    // Terms checkbox if present
    const checkbox = page.locator("input[type='checkbox']").first();
    if ((await checkbox.count()) > 0 && !(await checkbox.isChecked())) {
      try {
        await checkbox.check();
      } catch {
        // Fallback for custom styled checkboxes where input is covered by label/span
        await checkbox.check({ force: true }).catch(async () => {
          const label = page.locator("label:has(input[type='checkbox']), label[for*='terms' i]").first();
          if ((await label.count()) > 0) {
            await label.click();
          }
        });
      }
    }

    // Submit button
    const submitBtn = page.locator("button:has-text('Continue'), button:has-text('Submit'), button[type='submit']").first();
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.click();

    await page.waitForTimeout(3000);
    ctx.ui.showEmailNotice(email, 'PeopleConnect (TruthFinder & Intelius)');

    return true;
  }

  /**
   * Performs record search in the PeopleConnect portal using Name and optional DOB.
   */
  public static async searchRecords(
    page: Page,
    person: Person,
    location: Location,
    providerId: string,
    providerName: string,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];

    // The PeopleConnect portal search form has inputs for first name, last name, DOB, state
    try {
      const fnInput = page.locator("input[name*='first'], input[placeholder*='First']").first();
      if ((await fnInput.count()) > 0 && (await fnInput.isVisible())) {
        const parts = person.name.trim().split(/\s+/);
        await fnInput.fill(parts[0]);

        const lnInput = page.locator("input[name*='last'], input[placeholder*='Last']").first();
        if ((await lnInput.count()) > 0) {
          await lnInput.fill(parts.slice(1).join(' ') || parts[0]);
        }

        // DOB input if available
        if (person.dob) {
          const dobInput = page.locator("input[name*='dob'], input[name*='birth'], input[placeholder*='YYYY']").first();
          if ((await dobInput.count()) > 0 && (await dobInput.isVisible())) {
            await dobInput.fill(person.dob);
          }
        }

        const searchBtn = page.locator("button:has-text('Search'), button:has-text('Continue'), button[type='submit']").first();
        await searchBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch {
      // In case user hasn't finished email verification step yet
    }

    // Fallback/standard record candidate representation for PeopleConnect
    const canonicalId = `peopleconnect:${person.name.toLowerCase().replace(/\s+/g, '-')}:${location.city.toLowerCase()}-${location.state.toLowerCase()}`;

    candidates.push({
      providerId,
      providerName,
      id: canonicalId,
      targetPerson: person.name,
      name: person.name,
      locations: [`${location.city}, ${location.state}`],
      profileUrl: `${PEOPLECONNECT_PORTAL_URL}#${canonicalId}`,
      metadata: {
        network: 'PeopleConnect (TruthFinder & Intelius)',
        dob: person.dob,
      },
    });

    return candidates;
  }

  /**
   * Automates suppression rule setting on PeopleConnect.
   */
  public static async applySuppression(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult> {
    const email = candidate.verificationEmail || ctx.config.verification.email;
    if (!email) {
      return {
        providerId: candidate.providerId,
        recordId: candidate.id,
        status: 'failed',
        message:
          'PeopleConnect suppression requires a verification email in config.yaml under verification.email or person.verification_email',
      };
    }

    try {
      await this.requestEmailSession(ctx.page, email, ctx);

      ctx.ui.info(
        `PeopleConnect suppression email dispatched. Click the verification link in your email to open your authenticated portal session.`
      );

      return {
        providerId: candidate.providerId,
        recordId: candidate.id,
        status: 'requires_action',
        message: `PeopleConnect verification link sent to ${email}. Click the link to complete suppression across TruthFinder, Intelius, and Instant Checkmate.`,
        actionDetails: `Click verification link sent to ${email} to activate suppression rule`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        providerId: candidate.providerId,
        recordId: candidate.id,
        status: 'failed',
        message: `Failed during PeopleConnect session dispatch: ${errorMsg}`,
      };
    }
  }
}
