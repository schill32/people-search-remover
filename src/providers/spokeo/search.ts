import type { Page } from 'playwright';
import type { Location, SearchCandidate } from '../../types.js';

export function slugifySpokeo(text: string): string {
  return text
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Builds a Spokeo search URL.
 * Example: https://www.spokeo.com/Jane-Doe/TX/Austin
 */
export function buildSpokeoSearchUrl(name: string, location?: Location): string {
  const nameSlug = slugifySpokeo(name);
  if (location && location.city && location.state) {
    const state = location.state.toUpperCase();
    const citySlug = slugifySpokeo(location.city);
    return `https://www.spokeo.com/${nameSlug}/${state}/${citySlug}`;
  }
  return `https://www.spokeo.com/${nameSlug}`;
}

/**
 * Builds a Spokeo reverse email search URL.
 * Example: https://www.spokeo.com/email-search/search?e=jane.doe%40example.com
 */
export function buildSpokeoEmailSearchUrl(email: string): string {
  return `https://www.spokeo.com/email-search/search?e=${encodeURIComponent(email.trim())}`;
}

export function cleanSpokeoProfileUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim(), 'https://www.spokeo.com');
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.trim().split('?')[0];
  }
}

/**
 * Extracts candidate cards from Spokeo search result pages.
 */
export async function scrapeSpokeoCards(
  page: Page,
  targetPerson: string
): Promise<SearchCandidate[]> {
  const candidates: SearchCandidate[] = [];

  try {
    await page.waitForSelector("a[href*='/p']", { timeout: 8000 });
  } catch {
    // Continue even if selector wait timed out
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
    const links = Array.from(document.querySelectorAll("a[href*='/p']"));

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      // Ensure it's a person profile link ending with /p[digits] and not navigation (/people/, /privacy)
      if (
        !/\/p\d+($|\?)/.test(href) &&
        !/\/[^/]+\/[^/]+\/[^/]+\/p[a-zA-Z0-9]+($|\?)/.test(href)
      ) {
        continue;
      }

      const cleanHref = href.split('?')[0];
      if (seenUrls.has(cleanHref)) continue;
      seenUrls.add(cleanHref);

      const card = link.closest("div[class*='card'], div[class*='row'], div[class*='single-column-card']") || link.parentElement;
      const cardText = card ? card.textContent || '' : link.textContent || '';

      const nameEl = card ? card.querySelector("h2, h3, div[class*='title'], a[class*='name']") : link;
      const nameText = (nameEl ? nameEl.textContent : link.textContent || '').trim();

      // Age extraction
      const ageMatch = cardText.match(/Age\s*(:\s*)?(\d{2})/i) || cardText.match(/\b([2-9]\d)\s*(?:years\s*old)?\b/i);
      const ageText = ageMatch ? ageMatch[2] || ageMatch[1] : '';

      // Locations
      const locations: string[] = [];
      const locMatch = cardText.match(/(?:Lives in|Located in|Current|Resides in)\s*:?\s*([A-Za-z\s]+,\s*[A-Z]{2})/gi);
      if (locMatch) {
        for (const m of locMatch) {
          const c = m.replace(/(?:Lives in|Located in|Current|Resides in)\s*:?\s*/i, '').trim();
          if (c && !locations.includes(c)) locations.push(c);
        }
      }

      // If card text didn't extract location, attempt to parse from URL path (e.g. /Name/State/City/p...)
      if (locations.length === 0) {
        const urlParts = cleanHref.split('/').filter(Boolean);
        // Spokeo URLs: [ 'FirstName-LastName', 'State', 'City', 'p12345' ]
        if (urlParts.length >= 4) {
          const statePart = urlParts[urlParts.length - 3];
          const cityPart = urlParts[urlParts.length - 2];
          if (statePart && cityPart && !statePart.startsWith('p') && !cityPart.startsWith('p')) {
            const parsed = `${cityPart.replace(/-/g, ' ')}, ${statePart.replace(/-/g, ' ')}`;
            locations.push(parsed);
          }
        }
      }

      // Relatives
      const relatives: string[] = [];
      const relMatch = cardText.match(/(?:Related to|Relatives|Also seen as)\s*:?\s*([^.\n]+)/i);
      if (relMatch && relMatch[1]) {
        const rels = relMatch[1].split(/[,•;]/).map((r) => r.trim()).filter((r) => r.length > 2 && r.length < 30);
        relatives.push(...rels.slice(0, 5));
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
      : `https://www.spokeo.com${card.href.startsWith('/') ? '' : '/'}${card.href}`;

    candidates.push({
      providerId: 'spokeo',
      providerName: 'Spokeo',
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
