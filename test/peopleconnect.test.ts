import { describe, it, expect } from 'vitest';
import { TruthFinderProvider } from '../src/providers/peopleconnect/truthfinder.js';
import { InteliusProvider } from '../src/providers/peopleconnect/intelius.js';

describe('PeopleConnect Providers (TruthFinder & Intelius)', () => {
  it('instantiates TruthFinderProvider with correct metadata', () => {
    const tf = new TruthFinderProvider();
    expect(tf.id).toBe('truthfinder');
    expect(tf.name).toBe('TruthFinder');
    expect(tf.verificationType).toBe('email');
    expect(tf.network).toContain('PeopleConnect');
  });

  it('instantiates InteliusProvider with correct metadata', () => {
    const intelius = new InteliusProvider();
    expect(intelius.id).toBe('intelius');
    expect(intelius.name).toBe('Intelius');
    expect(intelius.verificationType).toBe('email');
    expect(intelius.network).toContain('PeopleConnect');
  });
});
