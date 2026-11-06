import { BaseProvider } from '../base.js';
import type {
  Location,
  Person,
  ProviderContext,
  SearchCandidate,
  SuppressionResult,
} from '../../types.js';
import { buildSpokeoSearchUrl, scrapeSpokeoCards } from './search.js';
import { submitSpokeoSuppression } from './suppression.js';

export class SpokeoProvider extends BaseProvider {
  public readonly id = 'spokeo';
  public readonly name = 'Spokeo';
  public readonly network = 'Spokeo Inc.';
  public readonly description =
    'People search directory suppression via profile URL submission and email confirmation link.';
  public readonly verificationType = 'email' as const;

  public async search(
    person: Person,
    location: Location,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const searchNames = [person.name, ...(person.aliases || [])];

    for (const queryName of searchNames) {
      const searchUrl = buildSpokeoSearchUrl(queryName, location);
      ctx.ui.info(`[Spokeo] Searching "${queryName}" in ${location.city}, ${location.state}...`);

      try {
        await ctx.page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        await this.randomDelay(1000, 2000);

        const cards = await scrapeSpokeoCards(ctx.page, person.name);
        ctx.ui.info(`[Spokeo] Found ${cards.length} match(es) for "${queryName}".`);

        for (const card of cards) {
          if (!candidates.some((c) => c.profileUrl === card.profileUrl)) {
            candidates.push(card);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.ui.warn(`[Spokeo] Search error for "${queryName}": ${errorMsg}`);
      }
    }

    return candidates;
  }

  public async suppress(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult> {
    return submitSpokeoSuppression(candidate.profileUrl, ctx);
  }
}
