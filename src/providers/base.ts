import type {
  Provider,
  ProviderContext,
  SearchCandidate,
  SuppressionResult,
  Person,
  Location,
} from '../types.js';

export abstract class BaseProvider implements Provider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public readonly network?: string;
  public abstract readonly description: string;
  public abstract readonly verificationType: 'phone' | 'email' | 'none' | 'hybrid';

  public abstract search(
    person: Person,
    location: Location,
    ctx: ProviderContext
  ): Promise<SearchCandidate[]>;

  public abstract suppress(
    candidate: SearchCandidate,
    ctx: ProviderContext
  ): Promise<SuppressionResult>;

  /**
   * Helper to clean URLs (strip query params, trailing slashes, fragments)
   */
  protected cleanUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl.trim());
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      return rawUrl.trim().split('?')[0].split('#')[0];
    }
  }

  /**
   * Humanized random delay between actions
   */
  protected async randomDelay(minMs = 800, maxMs = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
