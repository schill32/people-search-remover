import { describe, it, expect } from 'vitest';
import {
  buildTruePeopleSearchUrl,
  cleanTruePeopleSearchProfileUrl,
} from '../src/providers/truepeoplesearch/search.js';
import { TruePeopleSearchProvider } from '../src/providers/truepeoplesearch/index.js';

describe('TruePeopleSearch Provider Utilities', () => {
  it('builds canonical search URLs with city and state', () => {
    const url = buildTruePeopleSearchUrl('Jane Doe', {
      city: 'Austin',
      state: 'TX',
    });
    expect(url).toBe(
      'https://www.truepeoplesearch.com/results?name=Jane+Doe&citystatezip=Austin%2C+TX'
    );
  });

  it('builds search URL with name only when location is omitted', () => {
    const url = buildTruePeopleSearchUrl('Jane Doe');
    expect(url).toBe('https://www.truepeoplesearch.com/results?name=Jane+Doe');
  });

  it('cleans tracking parameters and hashes from profile URLs', () => {
    const dirtyUrl =
      'https://www.truepeoplesearch.com/find/person/pr4n8ulrr2468962nrrl?fs=1&searchedName=Jane+Doe#details';
    const clean = cleanTruePeopleSearchProfileUrl(dirtyUrl);
    expect(clean).toBe(
      'https://www.truepeoplesearch.com/find/person/pr4n8ulrr2468962nrrl'
    );
  });

  it('instantiates TruePeopleSearchProvider with correct metadata', () => {
    const provider = new TruePeopleSearchProvider();
    expect(provider.id).toBe('truepeoplesearch');
    expect(provider.name).toBe('TruePeopleSearch');
    expect(provider.verificationType).toBe('email');
    expect(provider.network).toBe('TruePeopleSearch');
    expect(provider.description).toContain('suppression');
  });
});
