// Google Flights deep-link builder.
//
// Google Flights does not document a public query API; the most reliable deep
// link is its text search route which pre-seeds the search box with a natural
// "Flights to X from Y on <date> through <date>" query.

export function buildGoogleFlightsUrl({ origin, destination, departDate, returnDate }) {
  const parts = [];
  parts.push(`Flights from ${origin || 'home'} to ${destination || 'anywhere'}`);
  if (departDate) parts.push(`on ${departDate}`);
  if (returnDate) parts.push(`through ${returnDate}`);
  const q = encodeURIComponent(parts.join(' '));
  return `https://www.google.com/travel/flights?q=${q}`;
}
