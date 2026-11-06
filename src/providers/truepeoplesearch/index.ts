import { BaseProvider } from '../base.js';
import type {
  Location,
  Person,
  ProviderContext,
  SearchCandidate,
  SuppressionResult,
} from '../../types.js';
import { buildTruePeopleSearchUrl, scrapeTruePeopleSearchCards } from './search.js';
import { submitTruePeopleSearchSuppression } from './suppression.js';

export class TruePeopleSearchProvider extends BaseProvider {
  public readonly id = 'truepeoplesearch';
  public readonly name = 'TruePeopleSearch';
  public readonly network = 'TruePeopleSearch';
  public readonly description =
    'Free public records directory suppression via removal portal and email confirmation link.';
  public readonly verificationType = 'email' as const;

  public async search(
    person: Person,
    location: Location,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const searchNames = [person.name, ...(person.aliases || [])];

    for (const queryName of searchNames) {
      const searchUrl = buildTruePeopleSearchUrl(queryName, location);
      ctx.ui.info(`[TruePeopleSearch] Searching "${queryName}" in ${location.city}, ${location.state}...`);

      try {
        await ctx.page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        // Humanized delay to respect rate limits
        await this.randomDelay(1000, 2000);

        const cards = await scrapeTruePeopleSearchCards(ctx.page, person.name);
        ctx.ui.info(`[TruePeopleSearch] Found ${cards.length} match(es) for "${queryName}".`);

        for (const card of cards) {
          if (!candidates.some((c) => c.profileUrl === card.profileUrl)) {
            candidates.push(card);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.ui.warn(`[TruePeopleSearch] Search error for "${queryName}": ${errorMsg}`);
      }
    }

    return candidates;
  }

  public async suppress(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult> {
    return submitTruePeopleSearchSuppression(candidate, ctx);
  }
}
