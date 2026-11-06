import { BaseProvider } from '../base.js';
import type {
  Location,
  Person,
  ProviderContext,
  SearchCandidate,
  SuppressionResult,
} from '../../types.js';
import { buildWhitepagesSearchUrl, scrapeWhitepagesCards } from './search.js';
import { submitWhitepagesSuppression } from './suppression.js';

export class WhitepagesProvider extends BaseProvider {
  public readonly id = 'whitepages';
  public readonly name = 'Whitepages';
  public readonly network = 'Whitepages Inc.';
  public readonly description =
    'Standard directory listing suppression via automated phone verification call.';
  public readonly verificationType = 'phone' as const;

  public async search(
    person: Person,
    location: Location,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const searchNames = [person.name, ...(person.aliases || [])];

    for (const queryName of searchNames) {
      const searchUrl = buildWhitepagesSearchUrl(queryName, location);
      ctx.ui.info(`[Whitepages] Searching "${queryName}" in ${location.city}, ${location.state}...`);

      try {
        await ctx.page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        // Delay to avoid trigger happy Cloudflare rates
        await this.randomDelay(1000, 2000);

        const cards = await scrapeWhitepagesCards(ctx.page, person.name);
        ctx.ui.info(`[Whitepages] Found ${cards.length} match(es) for "${queryName}".`);

        for (const card of cards) {
          if (!candidates.some((c) => c.profileUrl === card.profileUrl)) {
            candidates.push(card);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.ui.warn(`[Whitepages] Search error for "${queryName}": ${errorMsg}`);
      }
    }

    return candidates;
  }

  public async suppress(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult> {
    return submitWhitepagesSuppression(candidate.profileUrl, ctx);
  }
}
