import { describe, it, expect } from 'vitest';
import {
  buildWhitepagesSearchUrl,
  cleanWhitepagesProfileUrl,
  slugify,
} from '../src/providers/whitepages/search.js';

describe('Whitepages Provider Utilities', () => {
  it('slugifies names and cities cleanly', () => {
    expect(slugify('Jane Doe')).toBe('Jane-Doe');
    expect(slugify('John O\'Connor')).toBe('John-OConnor');
    expect(slugify('Austin, TX')).toBe('Austin-TX');
  });

  it('builds canonical search URLs with city and state', () => {
    const url = buildWhitepagesSearchUrl('Jane Doe', {
      city: 'Austin',
      state: 'TX',
    });
    expect(url).toBe('https://www.whitepages.com/name/Jane-Doe/Austin-TX');
  });

  it('builds search URL with name only when location is omitted', () => {
    const url = buildWhitepagesSearchUrl('Jane Doe');
    expect(url).toBe('https://www.whitepages.com/name/Jane-Doe');
  });

  it('cleans tracking parameters from profile URLs', () => {
    const dirtyUrl = 'https://www.whitepages.com/name/Jane-Doe/Austin-TX/PX3vBjnODk3?fs=1&searchedName=Jane+Doe';
    const clean = cleanWhitepagesProfileUrl(dirtyUrl);
    expect(clean).toBe('https://www.whitepages.com/name/Jane-Doe/Austin-TX/PX3vBjnODk3');
  });
});
