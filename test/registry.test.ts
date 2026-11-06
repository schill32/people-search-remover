import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../src/providers/registry.js';
import type { Provider, ProviderContext, SearchCandidate, SuppressionResult, Person, Location } from '../src/types.js';

class MockProvider implements Provider {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly verificationType: 'phone' | 'email' | 'none' | 'hybrid' = 'email',
    public readonly description = 'Mock provider'
  ) {}

  async search(_person: Person, _location: Location, _ctx: ProviderContext): Promise<SearchCandidate[]> {
    return [];
  }

  async suppress(_candidate: SearchCandidate, _ctx: ProviderContext): Promise<SuppressionResult> {
    return {
      providerId: this.id,
      recordId: '1',
      status: 'submitted',
      message: 'Done',
    };
  }
}

describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    const wp = new MockProvider('whitepages', 'Whitepages', 'phone');
    const sp = new MockProvider('spokeo', 'Spokeo', 'email');

    registry.register(wp);
    registry.register(sp);

    expect(registry.has('whitepages')).toBe(true);
    expect(registry.has('spokeo')).toBe(true);
    expect(registry.has('unknown')).toBe(false);

    expect(registry.get('Whitepages')?.name).toBe('Whitepages');
    expect(registry.getAll()).toHaveLength(2);
  });

  it('filters enabled providers by ID', () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider('whitepages', 'Whitepages'));
    registry.register(new MockProvider('spokeo', 'Spokeo'));
    registry.register(new MockProvider('beenverified', 'BeenVerified'));

    const enabled = registry.getEnabled(['whitepages', 'beenverified']);
    expect(enabled.map((p) => p.id)).toEqual(['whitepages', 'beenverified']);
  });

  it('throws when registering duplicate provider IDs', () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider('whitepages', 'Whitepages'));
    expect(() => registry.register(new MockProvider('whitepages', 'Duplicate'))).toThrow();
  });
});
