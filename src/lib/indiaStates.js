// Static mapping of all 36 Indian States & Union Territories used by the
// India Coverage Tracking progress wheel in the Insights dashboard.

export const INDIA_STATES = [
  // 28 States
  { code: 'AP', name: 'Andhra Pradesh', type: 'State' },
  { code: 'AR', name: 'Arunachal Pradesh', type: 'State' },
  { code: 'AS', name: 'Assam', type: 'State' },
  { code: 'BR', name: 'Bihar', type: 'State' },
  { code: 'CT', name: 'Chhattisgarh', type: 'State' },
  { code: 'GA', name: 'Goa', type: 'State' },
  { code: 'GJ', name: 'Gujarat', type: 'State' },
  { code: 'HR', name: 'Haryana', type: 'State' },
  { code: 'HP', name: 'Himachal Pradesh', type: 'State' },
  { code: 'JH', name: 'Jharkhand', type: 'State' },
  { code: 'KA', name: 'Karnataka', type: 'State' },
  { code: 'KL', name: 'Kerala', type: 'State' },
  { code: 'MP', name: 'Madhya Pradesh', type: 'State' },
  { code: 'MH', name: 'Maharashtra', type: 'State' },
  { code: 'MN', name: 'Manipur', type: 'State' },
  { code: 'ML', name: 'Meghalaya', type: 'State' },
  { code: 'MZ', name: 'Mizoram', type: 'State' },
  { code: 'NL', name: 'Nagaland', type: 'State' },
  { code: 'OR', name: 'Odisha', type: 'State' },
  { code: 'PB', name: 'Punjab', type: 'State' },
  { code: 'RJ', name: 'Rajasthan', type: 'State' },
  { code: 'SK', name: 'Sikkim', type: 'State' },
  { code: 'TN', name: 'Tamil Nadu', type: 'State' },
  { code: 'TG', name: 'Telangana', type: 'State' },
  { code: 'TR', name: 'Tripura', type: 'State' },
  { code: 'UP', name: 'Uttar Pradesh', type: 'State' },
  { code: 'UK', name: 'Uttarakhand', type: 'State' },
  { code: 'WB', name: 'West Bengal', type: 'State' },
  // 8 Union Territories
  { code: 'AN', name: 'Andaman and Nicobar Islands', type: 'UT' },
  { code: 'CH', name: 'Chandigarh', type: 'UT' },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'UT' },
  { code: 'DL', name: 'Delhi', type: 'UT' },
  { code: 'JK', name: 'Jammu and Kashmir', type: 'UT' },
  { code: 'LA', name: 'Ladakh', type: 'UT' },
  { code: 'LD', name: 'Lakshadweep', type: 'UT' },
  { code: 'PY', name: 'Puducherry', type: 'UT' },
];

export const TOTAL_REGIONS = INDIA_STATES.length; // 36

// Loose aliases so free-text "state" fields on trips resolve to canonical names.
const ALIASES = {
  pondicherry: 'Puducherry',
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  'j&k': 'Jammu and Kashmir',
  jk: 'Jammu and Kashmir',
  ncr: 'Delhi',
  'new delhi': 'Delhi',
  bengal: 'West Bengal',
};

/** Normalize an arbitrary state string to a canonical INDIA_STATES name (or null). */
export function canonicalState(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];
  const hit = INDIA_STATES.find((s) => s.name.toLowerCase() === key);
  if (hit) return hit.name;
  // partial / contains match as a fallback
  const partial = INDIA_STATES.find(
    (s) => s.name.toLowerCase().includes(key) || key.includes(s.name.toLowerCase()),
  );
  return partial ? partial.name : null;
}

/**
 * Compute India coverage from a list of trips.
 * @returns {{ visited: string[], remaining: string[], percent: number }}
 */
export function computeIndiaCoverage(trips = []) {
  const visited = new Set();
  for (const t of trips) {
    const c = canonicalState(t.state);
    if (c) visited.add(c);
  }
  const visitedNames = INDIA_STATES.filter((s) => visited.has(s.name)).map((s) => s.name);
  const remaining = INDIA_STATES.filter((s) => !visited.has(s.name)).map((s) => s.name);
  return {
    visited: visitedNames,
    remaining,
    percent: Math.round((visitedNames.length / TOTAL_REGIONS) * 100),
  };
}
