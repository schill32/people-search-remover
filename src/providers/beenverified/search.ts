import type { Page } from 'playwright';
import type { Location, SearchCandidate } from '../../types.js';

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Builds the BeenVerified opt-out portal URL.
 */
export function buildBeenVerifiedSearchUrl(
  firstName: string,
  lastName: string,
  state?: string
): string {
  const params = new URLSearchParams({
    fn: firstName,
    ln: lastName,
  });
  if (state) {
    params.set('state', state.toUpperCase());
  }
  return `https://www.beenverified.com/svc/optout/search/optouts?${params.toString()}`;
}

/**
 * Searches the BeenVerified opt-out portal and extracts candidate rows.
 */
export async function scrapeBeenVerifiedCandidates(
  page: Page,
  targetPerson: string
): Promise<SearchCandidate[]> {
  const candidates: SearchCandidate[] = [];

  try {
    await page.waitForSelector("button:has-text('Opt Out'), a:has-text('Opt Out'), [class*='optout-result'], table tr", {
      timeout: 10000,
    });
  } catch {
    // Continue even if timeout triggered
  }

  const rawResults = await page.evaluate(() => {
    const records: Array<{
      id: string;
      nameText: string;
      ageText: string;
      locations: string[];
      relatives: string[];
      optOutUrl: string;
    }> = [];

    // Search for rows or cards
    const rows = Array.from(document.querySelectorAll("tr, div[class*='result'], div[class*='card']"));

    for (const row of rows) {
      const btn = row.querySelector("button:has-text('Opt Out'), a:has-text('Opt Out'), a[href*='optout']");
      if (!btn) continue;

      const rowText = row.textContent || '';
      const href = btn.getAttribute('href') || window.location.href;
      const btnDataId = btn.getAttribute('data-id') || btn.getAttribute('data-person-id') || href;

      const nameEl = row.querySelector("h3, h4, span[class*='name'], strong, td:first-child");
      const nameText = (nameEl ? nameEl.textContent : '').trim();
      if (!nameText || nameText.toLowerCase().includes('first name')) continue;

      const ageMatch = rowText.match(/Age\s*(:\s*)?(\d{2})/i) || rowText.match(/\b([2-9]\d)\b/);
      const ageText = ageMatch ? ageMatch[2] || ageMatch[1] : '';

      const locations: string[] = [];
      const locMatch = rowText.match(/([A-Za-z\s]+,\s*[A-Z]{2})/g);
      if (locMatch) {
        for (const loc of locMatch) {
          if (!locations.includes(loc.trim())) locations.push(loc.trim());
        }
      }

      records.push({
        id: btnDataId,
        nameText,
        ageText,
        locations,
        relatives: [],
        optOutUrl: href.startsWith('http') ? href : window.location.origin + href,
      });
    }

    return records;
  });

  for (const r of rawResults) {
    candidates.push({
      providerId: 'beenverified',
      providerName: 'BeenVerified',
      id: r.id || r.optOutUrl,
      targetPerson,
      name: r.nameText,
      age: r.ageText || undefined,
      locations: r.locations,
      relatives: r.relatives.length > 0 ? r.relatives : undefined,
      profileUrl: r.optOutUrl,
      metadata: { recordId: r.id },
    });
  }

  return candidates;
}
