import type { Provider } from '../types.js';

export class ProviderRegistry {
  private providers = new Map<string, Provider>();

  public register(provider: Provider): void {
    const key = provider.id.toLowerCase();
    if (this.providers.has(key)) {
      throw new Error(`Provider with id "${provider.id}" is already registered.`);
    }
    this.providers.set(key, provider);
  }

  public get(id: string): Provider | undefined {
    return this.providers.get(id.toLowerCase());
  }

  public getAll(): Provider[] {
    return Array.from(this.providers.values());
  }

  public getEnabled(enabledIds?: string[]): Provider[] {
    if (!enabledIds || enabledIds.length === 0) {
      return this.getAll();
    }
    const normalized = new Set(enabledIds.map((id) => id.toLowerCase()));
    return this.getAll().filter((p) => normalized.has(p.id.toLowerCase()));
  }

  public has(id: string): boolean {
    return this.providers.has(id.toLowerCase());
  }
}
