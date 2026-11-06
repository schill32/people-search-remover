import { describe, it, expect } from 'vitest';
import { isLocationMatch } from '../src/location.js';

describe('Location Matching & Filtering', () => {
  it('matches city and state abbreviation correctly', () => {
    expect(isLocationMatch(['Austin, TX'], 'Austin', 'TX')).toBe(true);
    expect(isLocationMatch(['Seattle, WA'], 'Seattle', 'WA')).toBe(true);
    expect(isLocationMatch(['Waterloo, IL'], 'Waterloo', 'IL')).toBe(true);
  });

  it('matches full state name as well as abbreviation', () => {
    expect(isLocationMatch(['Waterloo, Illinois'], 'Waterloo', 'IL')).toBe(true);
    expect(isLocationMatch(['Austin, Texas'], 'Austin', 'TX')).toBe(true);
    expect(isLocationMatch(['Seattle, Washington'], 'Seattle', 'WA')).toBe(true);
  });

  it('handles case-insensitivity and punctuation variations', () => {
    expect(isLocationMatch(['WATERLOO IL'], 'Waterloo', 'IL')).toBe(true);
    expect(isLocationMatch(['waterloo, il.'], 'Waterloo', 'IL')).toBe(true);
    expect(isLocationMatch(['austin - tx'], 'Austin', 'TX')).toBe(true);
  });

  it('rejects candidate locations that do not match the city', () => {
    expect(isLocationMatch(['Columbia, IL'], 'Waterloo', 'IL')).toBe(false);
    expect(isLocationMatch(['Dallas, TX'], 'Austin', 'TX')).toBe(false);
    expect(isLocationMatch(['Thornton, CO'], 'Waterloo', 'IL')).toBe(false);
  });

  it('rejects candidate locations that do not match the state', () => {
    expect(isLocationMatch(['Waterloo, IA'], 'Waterloo', 'IL')).toBe(false);
  });

  it('returns false for empty location arrays', () => {
    expect(isLocationMatch([], 'Waterloo', 'IL')).toBe(false);
  });

  it('matches if any location in multiple candidate locations matches', () => {
    expect(
      isLocationMatch(['Columbia, IL', 'Waterloo, IL', 'St. Louis, MO'], 'Waterloo', 'IL')
    ).toBe(true);
  });
});
