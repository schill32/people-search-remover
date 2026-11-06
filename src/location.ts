export const US_STATE_NAMES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri',
  MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey',
  NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina',
  SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming',
  DC: 'district of columbia',
};

/**
 * Checks whether at least one candidate location string matches the target city and state.
 * Supports 2-letter state abbreviations (IL), full state names (Illinois), and punctuation variations.
 */
export function isLocationMatch(
  candidateLocations: string[],
  targetCity: string,
  targetState: string
): boolean {
  if (!candidateLocations || candidateLocations.length === 0) {
    return false;
  }

  const cityNorm = targetCity.trim().toLowerCase();
  const stateCode = targetState.trim().toUpperCase();
  const stateName = (US_STATE_NAMES[stateCode] || '').toLowerCase();

  return candidateLocations.some((locStr) => {
    const norm = locStr.toLowerCase().replace(/[,.-]/g, ' ');
    const hasCity = norm.includes(cityNorm);
    const hasState =
      new RegExp(`\\b${stateCode.toLowerCase()}\\b`).test(norm) ||
      (stateName ? norm.includes(stateName) : false);

    return hasCity && hasState;
  });
}
