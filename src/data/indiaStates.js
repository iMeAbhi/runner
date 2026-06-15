// Static mapping table of all 36 Indian States & Union Territories, used by the
// Analytics tab's "India Coverage" progress wheel. Aliases let us match trip
// `State_Country` strings written in slightly different forms.
export const INDIA_STATES = [
  { name: 'Andhra Pradesh', type: 'state', aliases: ['ap'] },
  { name: 'Arunachal Pradesh', type: 'state', aliases: [] },
  { name: 'Assam', type: 'state', aliases: [] },
  { name: 'Bihar', type: 'state', aliases: [] },
  { name: 'Chhattisgarh', type: 'state', aliases: [] },
  { name: 'Goa', type: 'state', aliases: [] },
  { name: 'Gujarat', type: 'state', aliases: [] },
  { name: 'Haryana', type: 'state', aliases: [] },
  { name: 'Himachal Pradesh', type: 'state', aliases: ['hp'] },
  { name: 'Jharkhand', type: 'state', aliases: [] },
  { name: 'Karnataka', type: 'state', aliases: [] },
  { name: 'Kerala', type: 'state', aliases: [] },
  { name: 'Madhya Pradesh', type: 'state', aliases: ['mp'] },
  { name: 'Maharashtra', type: 'state', aliases: [] },
  { name: 'Manipur', type: 'state', aliases: [] },
  { name: 'Meghalaya', type: 'state', aliases: [] },
  { name: 'Mizoram', type: 'state', aliases: [] },
  { name: 'Nagaland', type: 'state', aliases: [] },
  { name: 'Odisha', type: 'state', aliases: ['orissa'] },
  { name: 'Punjab', type: 'state', aliases: [] },
  { name: 'Rajasthan', type: 'state', aliases: [] },
  { name: 'Sikkim', type: 'state', aliases: [] },
  { name: 'Tamil Nadu', type: 'state', aliases: ['tn'] },
  { name: 'Telangana', type: 'state', aliases: ['ts'] },
  { name: 'Tripura', type: 'state', aliases: [] },
  { name: 'Uttar Pradesh', type: 'state', aliases: ['up'] },
  { name: 'Uttarakhand', type: 'state', aliases: ['uttaranchal'] },
  { name: 'West Bengal', type: 'state', aliases: ['wb'] },
  // Union Territories
  { name: 'Andaman and Nicobar Islands', type: 'ut', aliases: ['andaman'] },
  { name: 'Chandigarh', type: 'ut', aliases: [] },
  {
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    type: 'ut',
    aliases: ['daman', 'diu', 'dadra'],
  },
  { name: 'Delhi', type: 'ut', aliases: ['new delhi', 'ncr'] },
  { name: 'Jammu and Kashmir', type: 'ut', aliases: ['kashmir', 'j&k', 'jk'] },
  { name: 'Ladakh', type: 'ut', aliases: ['leh'] },
  { name: 'Lakshadweep', type: 'ut', aliases: [] },
  { name: 'Puducherry', type: 'ut', aliases: ['pondicherry'] },
];

export const TOTAL_INDIA_REGIONS = INDIA_STATES.length; // 36

/**
 * Match a free-text "State_Country" field to a canonical region name.
 * Returns the canonical name or null if it isn't an Indian region we track.
 */
export function matchRegion(stateCountry = '') {
  const hay = stateCountry.toLowerCase();
  for (const region of INDIA_STATES) {
    if (hay.includes(region.name.toLowerCase())) return region.name;
    if (region.aliases.some((a) => hay.includes(a))) return region.name;
  }
  return null;
}
