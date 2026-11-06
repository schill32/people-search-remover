import type { Page } from 'playwright';
import type { Location, SearchCandidate } from '../../types.js';

/**
 * Builds the TruePeopleSearch search URL for a given name and location.
 * Example: https://www.truepeoplesearch.com/results?name=Jane+Doe&citystatezip=Austin%2C+TX
 */
export function buildTruePeopleSearchUrl(name: string, location?: Location): string {
  const params = new URLSearchParams();
  params.set('name', name.trim());
  if (location && location.city && location.state) {
    params.set('citystatezip', `${location.city.trim()}, ${location.state.toUpperCase().trim()}`);
  }
  return `https://www.truepeoplesearch.com/results?${params.toString()}`;
}

/**
 * Cleans tracking parameters and fragments from TruePeopleSearch profile URLs.
 * Example: https://www.truepeoplesearch.com/find/person/p1234567890?extra=1 -> https://www.truepeoplesearch.com/find/person/p1234567890
 */
export function cleanTruePeopleSearchProfileUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim(), 'https://www.truepeoplesearch.com');
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.trim().split('?')[0].split('#')[0];
  }
}

/**
 * Evaluates the loaded search page and extracts candidate cards from TruePeopleSearch.
 */
export async function scrapeTruePeopleSearchCards(
  page: Page,
  targetPerson: string
): Promise<SearchCandidate[]> {
  const candidates: SearchCandidate[] = [];

  try {
    await page.waitForSelector('.card-summary, [data-detail-link], div.card', { timeout: 8000 });
  } catch {
    // Continue even if selector wait times out
  }

  const rawCards = await page.evaluate(() => {
    const results: Array<{
      href: string;
      nameText: string;
      ageText: string;
      locations: string[];
      relatives: string[];
    }> = [];

    const seenUrls = new Set<string>();

    // TruePeopleSearch cards typically have .card-summary and data-detail-link
    const cardElements = Array.from(
      document.querySelectorAll("div[data-detail-link], div.card-summary, div[class*='card']")
    );

    for (const card of cardElements) {
      // Find detail link: from attribute or internal link
      let detailPath = card.getAttribute('data-detail-link') || '';

      if (!detailPath) {
        const linkEl = card.querySelector("a[href*='/find/person/'], a.btn-success, a[data-link-to-more]");
        if (linkEl) {
          detailPath = linkEl.getAttribute('href') || '';
        }
      }

      if (!detailPath || !/\/find\/person\/p/i.test(detailPath)) {
        continue;
      }

      const cleanPath = detailPath.split('?')[0].split('#')[0];
      if (seenUrls.has(cleanPath)) continue;
      seenUrls.add(cleanPath);

      const cardText = card.textContent || '';

      // Extract Name: usually in .h4 or first strong/heading
      const nameEl = card.querySelector(".h4, span.h4, div.h4, h4, a.btn-success");
      const nameText = (nameEl ? nameEl.textContent : '').trim();

      // Extract Age: e.g. "Age: 45" or "Age 45"
      const ageMatch = cardText.match(/Age\s*:?\s*(\d{2})/i) || cardText.match(/\b([2-9]\d)\b/);
      const ageText = ageMatch ? ageMatch[1] : '';

      // Extract Locations: "Lives in City, ST" or "Used to live in City, ST"
      const locations: string[] = [];
      const locMatches = cardText.match(/(?:Lives in|Current|Resides in|Located in|Used to live in|Past|Previous|Locations?)\s*:?\s*([A-Za-z\s]+,\s*[A-Z]{2})/gi);
      if (locMatches) {
        for (const m of locMatches) {
          const cleaned = m.replace(/(?:Lives in|Current|Resides in|Located in|Used to live in|Past|Previous|Locations?)\s*:?\s*/i, '').trim();
          if (cleaned && !locations.includes(cleaned)) {
            locations.push(cleaned);
          }
        }
      }

      // If no locations caught by prefixed regex, scan for general City, ST pattern
      if (locations.length === 0) {
        const generalMatches = cardText.match(/([A-Za-z\s]+,\s*[A-Z]{2})/g);
        if (generalMatches) {
          for (const gm of generalMatches) {
            const trimmed = gm.trim();
            if (trimmed && !locations.includes(trimmed)) {
              locations.push(trimmed);
            }
          }
        }
      }

      // Extract Relatives: e.g. "Possible Relatives: Jane Doe, John Doe"
      const relatives: string[] = [];
      const relMatch = cardText.match(/(?:Possible Relatives|Relatives|Related to)\s*:?\s*([^.\n]+)/i);
      if (relMatch && relMatch[1]) {
        const rels = relMatch[1]
          .split(/[,•;]/)
          .map((r) => r.trim())
          .filter((r) => r.length > 2 && r.length < 30);
        relatives.push(...rels.slice(0, 5));
      }

      results.push({
        href: cleanPath,
        nameText: nameText || 'Unknown Name',
        ageText,
        locations,
        relatives,
      });
    }

    return results;
  });

  for (const card of rawCards) {
    const fullUrl = card.href.startsWith('http')
      ? card.href
      : `https://www.truepeoplesearch.com${card.href.startsWith('/') ? '' : '/'}${card.href}`;

    candidates.push({
      providerId: 'truepeoplesearch',
      providerName: 'TruePeopleSearch',
      id: fullUrl,
      targetPerson,
      name: card.nameText,
      age: card.ageText || undefined,
      locations: card.locations,
      relatives: card.relatives.length > 0 ? card.relatives : undefined,
      profileUrl: fullUrl,
    });
  }

  return candidates;
}
