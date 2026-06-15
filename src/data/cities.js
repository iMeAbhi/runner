// City → "State_Country" lookup powering the TripForm autocomplete + autofill.
//
// Value for Indian cities is the canonical State/UT name (so it also feeds the
// India-coverage tracker in indiaStates.js); international cities use a
// "Region, Country" or "Country" string. Keys are matched case-insensitively;
// common alternate spellings are included as their own keys.
export const CITY_TO_REGION = {
  // ── Delhi NCR ──
  'Delhi': 'Delhi', 'New Delhi': 'Delhi', 'Noida': 'Uttar Pradesh', 'Gurgaon': 'Haryana', 'Gurugram': 'Haryana',
  // ── Maharashtra ──
  'Mumbai': 'Maharashtra', 'Pune': 'Maharashtra', 'Nagpur': 'Maharashtra', 'Nashik': 'Maharashtra', 'Lonavala': 'Maharashtra', 'Aurangabad': 'Maharashtra',
  // ── Karnataka ──
  'Bangalore': 'Karnataka', 'Bengaluru': 'Karnataka', 'Mysore': 'Karnataka', 'Mysuru': 'Karnataka', 'Hampi': 'Karnataka', 'Mangalore': 'Karnataka', 'Coorg': 'Karnataka', 'Madikeri': 'Karnataka', 'Gokarna': 'Karnataka',
  // ── Tamil Nadu ──
  'Chennai': 'Tamil Nadu', 'Madurai': 'Tamil Nadu', 'Coimbatore': 'Tamil Nadu', 'Ooty': 'Tamil Nadu', 'Kodaikanal': 'Tamil Nadu', 'Rameswaram': 'Tamil Nadu',
  // ── Puducherry ──
  'Pondicherry': 'Puducherry', 'Puducherry': 'Puducherry',
  // ── Telangana / Andhra ──
  'Hyderabad': 'Telangana', 'Warangal': 'Telangana', 'Vijayawada': 'Andhra Pradesh', 'Visakhapatnam': 'Andhra Pradesh', 'Vizag': 'Andhra Pradesh', 'Tirupati': 'Andhra Pradesh',
  // ── West Bengal ──
  'Kolkata': 'West Bengal', 'Darjeeling': 'West Bengal', 'Siliguri': 'West Bengal', 'Kalimpong': 'West Bengal',
  // ── Rajasthan ──
  'Jaipur': 'Rajasthan', 'Udaipur': 'Rajasthan', 'Jodhpur': 'Rajasthan', 'Jaisalmer': 'Rajasthan', 'Pushkar': 'Rajasthan', 'Mount Abu': 'Rajasthan', 'Bikaner': 'Rajasthan',
  // ── Gujarat ──
  'Ahmedabad': 'Gujarat', 'Surat': 'Gujarat', 'Vadodara': 'Gujarat', 'Rajkot': 'Gujarat', 'Dwarka': 'Gujarat', 'Bhuj': 'Gujarat', 'Somnath': 'Gujarat',
  // ── Goa ──
  'Panaji': 'Goa', 'Panjim': 'Goa', 'Margao': 'Goa', 'Vasco': 'Goa', 'Calangute': 'Goa', 'Anjuna': 'Goa',
  // ── Kerala ──
  'Kochi': 'Kerala', 'Cochin': 'Kerala', 'Munnar': 'Kerala', 'Alleppey': 'Kerala', 'Alappuzha': 'Kerala', 'Thiruvananthapuram': 'Kerala', 'Trivandrum': 'Kerala', 'Wayanad': 'Kerala', 'Kovalam': 'Kerala', 'Thekkady': 'Kerala', 'Kumarakom': 'Kerala',
  // ── Uttar Pradesh ──
  'Lucknow': 'Uttar Pradesh', 'Agra': 'Uttar Pradesh', 'Varanasi': 'Uttar Pradesh', 'Mathura': 'Uttar Pradesh', 'Prayagraj': 'Uttar Pradesh', 'Allahabad': 'Uttar Pradesh', 'Kanpur': 'Uttar Pradesh', 'Ayodhya': 'Uttar Pradesh',
  // ── Madhya Pradesh ──
  'Bhopal': 'Madhya Pradesh', 'Indore': 'Madhya Pradesh', 'Gwalior': 'Madhya Pradesh', 'Khajuraho': 'Madhya Pradesh', 'Ujjain': 'Madhya Pradesh', 'Pachmarhi': 'Madhya Pradesh',
  // ── Bihar / Jharkhand / Chhattisgarh / Odisha ──
  'Patna': 'Bihar', 'Gaya': 'Bihar', 'Bodh Gaya': 'Bihar', 'Ranchi': 'Jharkhand', 'Jamshedpur': 'Jharkhand', 'Deoghar': 'Jharkhand', 'Raipur': 'Chhattisgarh',
  'Bhubaneswar': 'Odisha', 'Puri': 'Odisha', 'Konark': 'Odisha', 'Cuttack': 'Odisha',
  // ── Punjab / Haryana / Chandigarh ──
  'Chandigarh': 'Chandigarh', 'Amritsar': 'Punjab', 'Ludhiana': 'Punjab', 'Jalandhar': 'Punjab', 'Patiala': 'Punjab',
  // ── Himachal Pradesh ──
  'Shimla': 'Himachal Pradesh', 'Manali': 'Himachal Pradesh', 'Dharamshala': 'Himachal Pradesh', 'Dharamsala': 'Himachal Pradesh', 'Dalhousie': 'Himachal Pradesh', 'Kasol': 'Himachal Pradesh', 'Spiti': 'Himachal Pradesh', 'Kullu': 'Himachal Pradesh', 'McLeodganj': 'Himachal Pradesh',
  // ── Uttarakhand ──
  'Dehradun': 'Uttarakhand', 'Rishikesh': 'Uttarakhand', 'Haridwar': 'Uttarakhand', 'Nainital': 'Uttarakhand', 'Mussoorie': 'Uttarakhand', 'Auli': 'Uttarakhand', 'Ramnagar': 'Uttarakhand',
  // ── J&K / Ladakh ──
  'Srinagar': 'Jammu and Kashmir', 'Gulmarg': 'Jammu and Kashmir', 'Pahalgam': 'Jammu and Kashmir', 'Jammu': 'Jammu and Kashmir', 'Sonamarg': 'Jammu and Kashmir',
  'Leh': 'Ladakh', 'Kargil': 'Ladakh', 'Nubra': 'Ladakh',
  // ── Northeast + Sikkim ──
  'Gangtok': 'Sikkim', 'Pelling': 'Sikkim', 'Lachung': 'Sikkim', 'Guwahati': 'Assam', 'Kaziranga': 'Assam', 'Jorhat': 'Assam',
  'Shillong': 'Meghalaya', 'Cherrapunji': 'Meghalaya', 'Imphal': 'Manipur', 'Aizawl': 'Mizoram', 'Kohima': 'Nagaland',
  'Itanagar': 'Arunachal Pradesh', 'Tawang': 'Arunachal Pradesh', 'Agartala': 'Tripura',
  // ── Islands / UTs ──
  'Port Blair': 'Andaman and Nicobar Islands', 'Havelock': 'Andaman and Nicobar Islands', 'Kavaratti': 'Lakshadweep', 'Daman': 'Dadra and Nagar Haveli and Daman and Diu', 'Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  // ── International ──
  'Kathmandu': 'Nepal', 'Pokhara': 'Nepal', 'Ubud': 'Bali, Indonesia', 'Denpasar': 'Bali, Indonesia', 'Bangkok': 'Thailand', 'Phuket': 'Thailand', 'Chiang Mai': 'Thailand',
  'Singapore': 'Singapore', 'Kuala Lumpur': 'Malaysia', 'Dubai': 'UAE', 'Abu Dhabi': 'UAE', 'Colombo': 'Sri Lanka', 'Kandy': 'Sri Lanka', 'Male': 'Maldives',
  'Paris': 'France', 'London': 'United Kingdom', 'Rome': 'Italy', 'Tokyo': 'Japan', 'New York': 'USA',
};

// Sorted unique city names for the <datalist> suggestions.
export const CITY_NAMES = Object.keys(CITY_TO_REGION).sort();

/** Case-insensitive lookup of the region for a city name. Returns '' if unknown. */
export function regionForCity(city = '') {
  const key = city.trim().toLowerCase();
  for (const name in CITY_TO_REGION) {
    if (name.toLowerCase() === key) return CITY_TO_REGION[name];
  }
  return '';
}
