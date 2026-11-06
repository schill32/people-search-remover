import { BaseProvider } from '../base.js';
import type {
  Location,
  Person,
  ProviderContext,
  SearchCandidate,
  SuppressionResult,
} from '../../types.js';
import {
  buildBeenVerifiedSearchUrl,
  scrapeBeenVerifiedCandidates,
  splitFullName,
} from './search.js';
import { submitBeenVerifiedSuppression } from './suppression.js';

export class BeenVerifiedProvider extends BaseProvider {
  public readonly id = 'beenverified';
  public readonly name = 'BeenVerified';
  public readonly network = 'The Lifetime Value Co.';
  public readonly description =
    'Opt-out search portal suppression via email verification link.';
  public readonly verificationType = 'email' as const;

  public async search(
    person: Person,
    location: Location,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]> {
    const candidates: SearchCandidate[] = [];
    const searchNames = [person.name, ...(person.aliases || [])];

    for (const queryName of searchNames) {
      const { firstName, lastName } = splitFullName(queryName);
      const searchUrl = buildBeenVerifiedSearchUrl(firstName, lastName, location.state);
      ctx.ui.info(
        `[BeenVerified] Searching "${queryName}" in ${location.state}...`
      );

      try {
        await ctx.page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        await this.randomDelay(1000, 2000);

        const cards = await scrapeBeenVerifiedCandidates(ctx.page, person.name);
        ctx.ui.info(`[BeenVerified] Found ${cards.length} match(es) for "${queryName}".`);

        for (const card of cards) {
          if (!candidates.some((c) => c.id === card.id)) {
            candidates.push(card);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.ui.warn(`[BeenVerified] Search error for "${queryName}": ${errorMsg}`);
      }
    }

    return candidates;
  }

  public async suppress(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult> {
    return submitBeenVerifiedSuppression(candidate, ctx);
  }
}
