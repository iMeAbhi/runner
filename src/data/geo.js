// Lightweight geo layer for the Quests map. No external mapping libraries —
// everything is a hand-traced silhouette plus an equirectangular projection so
// the same coordinate space drives the India outline, region nodes, quest nodes
// and the transit vectors radiating from home/current location.

// Bounding box (with a little breathing room) covering mainland India + the
// island UTs. Latitudes shrink top→bottom in SVG space, so y is inverted.
export const GEO_BOUNDS = { latMax: 37.5, latMin: 6.5, lngMin: 67.5, lngMax: 97.5 };

/**
 * Project a {lat,lng} onto an SVG canvas of size w×h with uniform padding.
 * Returns {x, y} in SVG user units.
 */
export function projectPoint(lat, lng, { w, h, pad = 12 }) {
  const { latMax, latMin, lngMin, lngMax } = GEO_BOUNDS;
  const x = pad + ((lng - lngMin) / (lngMax - lngMin)) * (w - 2 * pad);
  const y = pad + ((latMax - lat) / (latMax - latMin)) * (h - 2 * pad);
  return { x, y };
}

// Rough clockwise silhouette of mainland India as [lat, lng] vertices. It is a
// deliberately minimalist outline — enough to read as "India" behind the nodes,
// not a survey-grade border.
export const INDIA_OUTLINE = [
  [34.5, 74.5], [35.4, 76.5], [34.3, 78.4], [32.3, 78.8], [30.7, 80.3],
  [28.5, 83.5], [27.6, 88.2], [27.2, 89.5], [27.8, 92.0], [28.2, 95.2],
  [27.3, 97.0], [25.0, 95.2], [23.5, 93.5], [22.3, 92.6], [23.6, 91.2],
  [25.2, 89.9], [24.5, 89.0], [22.2, 88.9], [20.8, 87.0], [18.5, 84.5],
  [16.0, 81.5], [13.5, 80.3], [10.8, 79.9], [8.1, 77.5], [8.5, 76.9],
  [11.0, 75.4], [13.5, 74.6], [15.5, 73.8], [18.0, 72.9], [19.9, 72.7],
  [21.0, 72.6], [20.8, 70.4], [22.4, 69.1], [23.5, 68.3], [24.7, 70.8],
  [26.5, 70.2], [28.4, 70.5], [30.0, 73.9], [32.3, 75.3],
];

// Approximate centroid coordinates for each of the 36 States & UTs, keyed by
// the canonical name used in indiaStates.js. Drives the India-coverage map.
export const REGION_COORDS = {
  'Andhra Pradesh': [15.9, 79.7],
  'Arunachal Pradesh': [28.0, 94.7],
  'Assam': [26.2, 92.9],
  'Bihar': [25.6, 85.1],
  'Chhattisgarh': [21.3, 81.8],
  'Goa': [15.3, 74.1],
  'Gujarat': [22.6, 71.5],
  'Haryana': [29.1, 76.1],
  'Himachal Pradesh': [31.9, 77.2],
  'Jharkhand': [23.6, 85.3],
  'Karnataka': [15.3, 75.7],
  'Kerala': [10.5, 76.3],
  'Madhya Pradesh': [23.5, 78.5],
  'Maharashtra': [19.7, 75.7],
  'Manipur': [24.7, 93.9],
  'Meghalaya': [25.5, 91.4],
  'Mizoram': [23.3, 92.8],
  'Nagaland': [26.1, 94.5],
  'Odisha': [20.5, 84.9],
  'Punjab': [31.1, 75.3],
  'Rajasthan': [27.0, 74.2],
  'Sikkim': [27.5, 88.5],
  'Tamil Nadu': [11.1, 78.6],
  'Telangana': [17.9, 79.0],
  'Tripura': [23.7, 91.7],
  'Uttar Pradesh': [26.8, 80.9],
  'Uttarakhand': [30.0, 79.3],
  'West Bengal': [22.9, 87.8],
  'Andaman and Nicobar Islands': [11.7, 92.7],
  'Chandigarh': [30.7, 76.8],
  'Dadra and Nagar Haveli and Daman and Diu': [20.3, 73.0],
  'Delhi': [28.6, 77.2],
  'Jammu and Kashmir': [33.8, 75.0],
  'Ladakh': [34.2, 77.6],
  'Lakshadweep': [10.6, 72.6],
  'Puducherry': [11.9, 79.8],
};

// Coordinates for notable cities — used to anchor the transit map's origin
// (the user's home / current location) and to refine individual trip nodes.
export const CITY_COORDS = {
  'kolkata': [22.57, 88.36], 'hyderabad': [17.38, 78.49], 'mumbai': [19.08, 72.88],
  'delhi': [28.61, 77.21], 'new delhi': [28.61, 77.21], 'bangalore': [12.97, 77.59],
  'bengaluru': [12.97, 77.59], 'chennai': [13.08, 80.27], 'pune': [18.52, 73.86],
  'jaipur': [26.91, 75.79], 'ahmedabad': [23.02, 72.57], 'kochi': [9.93, 76.27],
  'goa': [15.49, 73.83], 'panaji': [15.49, 73.83], 'lucknow': [26.85, 80.95],
  'varanasi': [25.32, 83.01], 'bhopal': [23.26, 77.41], 'indore': [22.72, 75.86],
  'patna': [25.59, 85.14], 'guwahati': [26.14, 91.74], 'srinagar': [34.08, 74.80],
  'leh': [34.16, 77.58], 'shimla': [31.10, 77.17], 'dehradun': [30.32, 78.03],
  'gangtok': [27.33, 88.61], 'shillong': [25.58, 91.89], 'amritsar': [31.63, 74.87],
  'chandigarh': [30.73, 76.78], 'jodhpur': [26.24, 73.02], 'udaipur': [24.59, 73.71],
  'visakhapatnam': [17.69, 83.22], 'vizag': [17.69, 83.22], 'bhubaneswar': [20.30, 85.82],
  'thiruvananthapuram': [8.52, 76.94], 'trivandrum': [8.52, 76.94], 'port blair': [11.62, 92.73],
  'agra': [27.18, 78.01], 'nagpur': [21.15, 79.09], 'surat': [21.17, 72.83],
  'darjeeling': [27.04, 88.26], 'rishikesh': [30.09, 78.27], 'haridwar': [29.95, 78.16],
};
