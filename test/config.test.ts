import { describe, it, expect } from 'vitest';
import { parseConfigYaml, ConfigError } from '../src/config.js';

describe('Config Parser & Validation', () => {
  it('parses a valid configuration YAML', () => {
    const yaml = `
verification:
  phone: "555-123-4567"
  email: "privacy@example.com"
browser:
  headless: true
  slow_mo_ms: 50
enabled_providers:
  - whitepages
  - spokeo
opt_out_reason: "Personal privacy"
people:
  - name: "Jane Doe"
    dob: "1985-04-12"
    locations:
      - city: "Austin"
        state: "TX"
    aliases:
      - "Jane M Doe"
`;
    const config = parseConfigYaml(yaml);
    expect(config.verification.phone).toBe('555-123-4567');
    expect(config.verification.email).toBe('privacy@example.com');
    expect(config.browser.headless).toBe(true);
    expect(config.browser.slow_mo_ms).toBe(50);
    expect(config.enabled_providers).toEqual(['whitepages', 'spokeo']);
    expect(config.people).toHaveLength(1);
    expect(config.people[0].name).toBe('Jane Doe');
    expect(config.people[0].locations[0].city).toBe('Austin');
    expect(config.people[0].locations[0].state).toBe('TX');
    expect(config.people[0].aliases).toEqual(['Jane M Doe']);
  });

  it('uppercases 2-letter state abbreviations', () => {
    const yaml = `
people:
  - name: "John Smith"
    locations:
      - city: "Denver"
        state: "co"
`;
    const config = parseConfigYaml(yaml);
    expect(config.people[0].locations[0].state).toBe('CO');
  });

  it('throws ConfigError on invalid YAML syntax', () => {
    const invalidYaml = `
people:
  - name: [broken
`;
    expect(() => parseConfigYaml(invalidYaml)).toThrowError(ConfigError);
  });

  it('throws ConfigError when required fields are missing', () => {
    const missingPeople = `
verification:
  phone: "123"
people: []
`;
    expect(() => parseConfigYaml(missingPeople)).toThrowError(ConfigError);
  });

  it('throws ConfigError when state abbreviation is invalid', () => {
    const invalidState = `
people:
  - name: "John Smith"
    locations:
      - city: "Denver"
        state: "COLORADO"
`;
    expect(() => parseConfigYaml(invalidState)).toThrowError(ConfigError);
  });

  it('validates email format if provided', () => {
    const invalidEmail = `
verification:
  email: "not-an-email"
people:
  - name: "John Smith"
    locations:
      - city: "Denver"
        state: "CO"
`;
    expect(() => parseConfigYaml(invalidEmail)).toThrowError(ConfigError);
  });
});
