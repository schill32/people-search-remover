import { BaseProvider } from '../base.js';
import type {
  Location,
  Person,
  ProviderContext,
  SearchCandidate,
  SuppressionResult,
} from '../../types.js';
import { PeopleConnectClient } from './client.js';

export class TruthFinderProvider extends BaseProvider {
  public readonly id = 'truthfinder';
  public readonly name = 'TruthFinder';
  public readonly network = 'PeopleConnect Network';
  public readonly description =
    'Background and people search suppression managed centrally via PeopleConnect.';
  public readonly verificationType = 'email' as const;

  public async search(
    person: Person,
    location: Location,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]> {
    ctx.ui.info(`[TruthFinder] Preparing suppression candidate for "${person.name}"...`);
    return PeopleConnectClient.searchRecords(
      ctx.page,
      person,
      location,
      this.id,
      this.name,
      ctx
    );
  }

  public async suppress(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult> {
    return PeopleConnectClient.applySuppression(candidate, ctx);
  }
}
