import { describe, it, expect } from 'vitest';
import {
  buildSpokeoSearchUrl,
  cleanSpokeoProfileUrl,
  slugifySpokeo,
} from '../src/providers/spokeo/search.js';

describe('Spokeo Provider Utilities', () => {
  it('slugifies names and cities cleanly', () => {
    expect(slugifySpokeo('Jane Doe')).toBe('Jane-Doe');
    expect(slugifySpokeo('Austin')).toBe('Austin');
  });

  it('builds canonical search URLs with state and city', () => {
    const url = buildSpokeoSearchUrl('Jane Doe', {
      city: 'Austin',
      state: 'TX',
    });
    expect(url).toBe('https://www.spokeo.com/Jane-Doe/TX/Austin');
  });

  it('builds search URL with name only when location is omitted', () => {
    const url = buildSpokeoSearchUrl('Jane Doe');
    expect(url).toBe('https://www.spokeo.com/Jane-Doe');
  });

  it('cleans tracking parameters from profile URLs', () => {
    const dirtyUrl = 'https://www.spokeo.com/Jane-Doe/TX/Austin/p12345?loaded=1&ref=search';
    const clean = cleanSpokeoProfileUrl(dirtyUrl);
    expect(clean).toBe('https://www.spokeo.com/Jane-Doe/TX/Austin/p12345');
  });
});
