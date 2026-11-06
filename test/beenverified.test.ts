import { describe, it, expect } from 'vitest';
import {
  buildBeenVerifiedSearchUrl,
  splitFullName,
} from '../src/providers/beenverified/search.js';

describe('BeenVerified Provider Utilities', () => {
  it('splits full names into first and last components', () => {
    expect(splitFullName('Jane Doe')).toEqual({ firstName: 'Jane', lastName: 'Doe' });
    expect(splitFullName('Jane Mary Doe')).toEqual({ firstName: 'Jane', lastName: 'Mary Doe' });
    expect(splitFullName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
  });

  it('builds opt-out portal search URL with state', () => {
    const url = buildBeenVerifiedSearchUrl('Jane', 'Doe', 'TX');
    expect(url).toBe('https://www.beenverified.com/svc/optout/search/optouts?fn=Jane&ln=Doe&state=TX');
  });

  it('builds opt-out portal search URL without state', () => {
    const url = buildBeenVerifiedSearchUrl('Jane', 'Doe');
    expect(url).toBe('https://www.beenverified.com/svc/optout/search/optouts?fn=Jane&ln=Doe');
  });
});
