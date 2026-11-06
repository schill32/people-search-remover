import type { Page } from 'playwright';
import type { Location, SearchCandidate } from '../../types.js';

export function slugify(text: string): string {
  return text
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Builds the Whitepages search URL for a given name and location.
 * Example: https://www.whitepages.com/name/Jane-Doe/Austin-TX
 */
export function buildWhitepagesSearchUrl(name: string, location?: Location): string {
  const nameSlug = slugify(name);
  if (location && location.city && location.state) {
    const locSlug = `${slugify(location.city)}-${location.state.toUpperCase()}`;
    return `https://www.whitepages.com/name/${nameSlug}/${locSlug}`;
  }
  return `https://www.whitepages.com/name/${nameSlug}`;
}

/**
 * Strips tracking parameters from Whitepages profile URLs
 * Example: https://www.whitepages.com/name/Jane-Doe/Austin-TX/PX123?fs=1 -> https://www.whitepages.com/name/Jane-Doe/Austin-TX/PX123
 */
export function cleanWhitepagesProfileUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim(), 'https://www.whitepages.com');
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.trim().split('?')[0];
  }
}

/**
 * Evaluates the loaded search page and extracts candidate cards.
 */
export async function scrapeWhitepagesCards(
  page: Page,
  targetPerson: string
): Promise<SearchCandidate[]> {
  const candidates: SearchCandidate[] = [];

  // Wait for results container or cards
  try {
    await page.waitForSelector("a[href*='/name/']", { timeout: 8000 });
  } catch {
    // If no results or slow, continue to check DOM
  }

  // Extract candidate cards using in-browser evaluation
  const rawCards = await page.evaluate(() => {
    const results: Array<{
      href: string;
      nameText: string;
      ageText: string;
      locations: string[];
      relatives: string[];
    }> = [];

    // Find links that match direct personal profile pattern: /name/Full-Name/City-ST/ID
    const profileLinkPattern = /\/name\/[^/]+\/[^/]+-[A-Z]{2}\/[A-Za-z0-9]+/;
    const allLinks = Array.from(document.querySelectorAll('a[href]'));

    const seenUrls = new Set<string>();

    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      if (!profileLinkPattern.test(href)) continue;

      const cleanHref = href.split('?')[0];
      if (seenUrls.has(cleanHref)) continue;
      seenUrls.add(cleanHref);

      // Find the parent card / container for context
      const card = link.closest("div[class*='card'], li, article, section, div[class*='result']") || link.parentElement;

      const cardText = card ? card.textContent || '' : link.textContent || '';

      // Extract Name
      const nameEl = card ? card.querySelector("h2, h3, h4, span[class*='name'], a[class*='name']") : link;
      const nameText = (nameEl ? nameEl.textContent : link.textContent || '').trim();

      // Extract Age
      const ageMatch = cardText.match(/Age\s*(:\s*)?(\d{2}s?|\d{2})/i) || cardText.match(/\b(2\d|3\d|4\d|5\d|6\d|7\d|8\d|9\d)\b/);
      const ageText = ageMatch ? ageMatch[1] || ageMatch[0] : '';

      // Extract Locations
      const locations: string[] = [];
      const locMatches = cardText.match(/(?:Lives in|Current|Resides in|Locations?)\s*:?\s*([A-Za-z\s]+,\s*[A-Z]{2})/gi);
      if (locMatches) {
        for (const m of locMatches) {
          const cleaned = m.replace(/(?:Lives in|Current|Resides in|Locations?)\s*:?\s*/i, '').trim();
          if (cleaned && !locations.includes(cleaned)) locations.push(cleaned);
        }
      }

      // If regex didn't catch, try parsing from URL path
      if (locations.length === 0) {
        const parts = cleanHref.split('/');
        if (parts.length >= 4) {
          const locPart = parts[3]; // e.g. Austin-TX
          locations.push(locPart.replace('-', ', '));
        }
      }

      // Extract Relatives
      const relatives: string[] = [];
      const relSection = cardText.match(/(?:Related to|Relatives|May go by)\s*:?\s*([^.\n]+)/i);
      if (relSection && relSection[1]) {
        const names = relSection[1].split(/[,•;]/).map((n) => n.trim()).filter((n) => n.length > 2 && n.length < 30);
        relatives.push(...names.slice(0, 5));
      }

      results.push({
        href: cleanHref,
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
      : `https://www.whitepages.com${card.href.startsWith('/') ? '' : '/'}${card.href}`;

    candidates.push({
      providerId: 'whitepages',
      providerName: 'Whitepages',
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
