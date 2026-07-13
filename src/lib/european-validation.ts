/**
 * European countries and postcode validation utilities
 * Supports all European countries for address validation
 */

// List of all European countries (ISO 3166-1 alpha-2 codes)
export const EUROPEAN_COUNTRIES = [
  'AD', // Andorra
  'AL', // Albania
  'AT', // Austria
  'BA', // Bosnia and Herzegovina
  'BE', // Belgium
  'BG', // Bulgaria
  'BY', // Belarus
  'CH', // Switzerland
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DE', // Germany
  'DK', // Denmark
  'EE', // Estonia
  'ES', // Spain
  'FI', // Finland
  'FR', // France
  'GB', // United Kingdom
  'GR', // Greece
  'HR', // Croatia
  'HU', // Hungary
  'IE', // Ireland
  'IS', // Iceland
  'IT', // Italy
  'LI', // Liechtenstein
  'LT', // Lithuania
  'LU', // Luxembourg
  'LV', // Latvia
  'MC', // Monaco
  'MD', // Moldova
  'ME', // Montenegro
  'MK', // North Macedonia
  'MT', // Malta
  'NL', // Netherlands
  'NO', // Norway
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'RS', // Serbia
  'SE', // Sweden
  'SI', // Slovenia
  'SK', // Slovakia
  'SM', // San Marino
  'TR', // Turkey (European part)
  'UA', // Ukraine
  'VA', // Vatican City
  'XK', // Kosovo
] as const;

// European country names and their variations
export const EUROPEAN_COUNTRY_NAMES: Record<string, string[]> = {
  'albania': ['albania', 'al', 'shqipëria'],
  'andorra': ['andorra', 'ad'],
  'austria': ['austria', 'at', 'österreich', 'autriche'],
  'belarus': ['belarus', 'by', 'беларусь', 'white russia'],
  'belgium': ['belgium', 'be', 'belgië', 'belgique', 'belgien'],
  'bosnia and herzegovina': ['bosnia and herzegovina', 'ba', 'bosnia', 'herzegovina', 'босна и херцеговина'],
  'bulgaria': ['bulgaria', 'bg', 'българия'],
  'croatia': ['croatia', 'hr', 'hrvatska'],
  'cyprus': ['cyprus', 'cy', 'κύπρος', 'kıbrıs'],
  'czech republic': ['czech republic', 'cz', 'czechia', 'česká republika', 'czech'],
  'denmark': ['denmark', 'dk', 'danmark'],
  'estonia': ['estonia', 'ee', 'eesti'],
  'finland': ['finland', 'fi', 'suomi'],
  'france': ['france', 'fr', 'french republic', 'république française'],
  'germany': ['germany', 'de', 'deutschland', 'federal republic of germany'],
  'greece': ['greece', 'gr', 'hellas', 'ελλάδα', 'hellenic republic'],
  'hungary': ['hungary', 'hu', 'magyarország'],
  'iceland': ['iceland', 'is', 'ísland'],
  'ireland': ['ireland', 'ie', 'éire', 'republic of ireland'],
  'italy': ['italy', 'it', 'italia', 'italian republic'],
  'kosovo': ['kosovo', 'xk'],
  'latvia': ['latvia', 'lv', 'latvija'],
  'liechtenstein': ['liechtenstein', 'li', 'fürstentum liechtenstein'],
  'lithuania': ['lithuania', 'lt', 'lietuva'],
  'luxembourg': ['luxembourg', 'lu', 'luxemburg', 'groussherzogtum lëtzebuerg'],
  'malta': ['malta', 'mt', 'republic of malta'],
  'moldova': ['moldova', 'md', 'republic of moldova', 'moldova republic'],
  'monaco': ['monaco', 'mc', 'principality of monaco'],
  'montenegro': ['montenegro', 'me', 'crna gora', 'црна гора'],
  'netherlands': ['netherlands', 'nl', 'holland', 'nederland', 'the netherlands'],
  'north macedonia': ['north macedonia', 'mk', 'macedonia', 'северна македонија'],
  'norway': ['norway', 'no', 'norge', 'noreg', 'kingdom of norway'],
  'poland': ['poland', 'pl', 'polska', 'republic of poland'],
  'portugal': ['portugal', 'pt', 'portuguese republic'],
  'romania': ['romania', 'ro', 'românia'],
  'russia': ['russia', 'ru', 'russian federation', 'россия', 'российская федерация'],
  'san marino': ['san marino', 'sm', 'republic of san marino'],
  'serbia': ['serbia', 'rs', 'србија', 'srbija'],
  'slovakia': ['slovakia', 'sk', 'slovak republic', 'slovensko'],
  'slovenia': ['slovenia', 'si', 'slovenija', 'republic of slovenia'],
  'spain': ['spain', 'es', 'españa', 'reino de españa', 'kingdom of spain'],
  'sweden': ['sweden', 'se', 'sverige', 'kingdom of sweden'],
  'switzerland': ['switzerland', 'ch', 'schweiz', 'suisse', 'svizzera', 'svizra', 'swiss confederation'],
  'turkey': ['turkey', 'tr', 'türkiye', 'republic of turkey'],
  'ukraine': ['ukraine', 'ua', 'україна', 'ukraina'],
  'united kingdom': ['united kingdom', 'gb', 'uk', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland'],
  'vatican city': ['vatican city', 'va', 'vatican', 'holy see', 'vaticano'],
} as const;

// Postcode patterns for European countries
// Format: { countryCode: RegExp }
export const EUROPEAN_POSTCODE_PATTERNS: Record<string, RegExp> = {
  // UK: A9 9AA, A99 9AA, AA9 9AA, AA99 9AA, A9A 9AA, AA9A 9AA
  'GB': /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
  
  // Germany: 5 digits (e.g., 10115)
  'DE': /^\d{5}$/,
  
  // France: 5 digits (e.g., 75001)
  'FR': /^\d{5}$/,
  
  // Italy: 5 digits (e.g., 00118)
  'IT': /^\d{5}$/,
  
  // Spain: 5 digits (e.g., 28001)
  'ES': /^\d{5}$/,
  
  // Netherlands: 4 digits + 2 letters (e.g., 1234 AB)
  'NL': /^\d{4}\s?[A-Z]{2}$/i,
  
  // Belgium: 4 digits (e.g., 1000)
  'BE': /^\d{4}$/,
  
  // Austria: 4 digits (e.g., 1010)
  'AT': /^\d{4}$/,
  
  // Switzerland: 4 digits (e.g., 8001)
  'CH': /^\d{4}$/,
  
  // Poland: 5 digits with optional dash (e.g., 00-001 or 00001)
  'PL': /^\d{2}-?\d{3}$/,
  
  // Czech Republic: 5 digits with optional space (e.g., 120 00 or 12000)
  'CZ': /^\d{3}\s?\d{2}$/,
  
  // Sweden: 5 digits with optional space (e.g., 123 45 or 12345)
  'SE': /^\d{3}\s?\d{2}$/,
  
  // Norway: 4 digits (e.g., 0001)
  'NO': /^\d{4}$/,
  
  // Denmark: 4 digits (e.g., 1000)
  'DK': /^\d{4}$/,
  
  // Finland: 5 digits (e.g., 00100)
  'FI': /^\d{5}$/,
  
  // Portugal: 4 digits + dash + 3 digits (e.g., 1000-001)
  'PT': /^\d{4}-?\d{3}$/,
  
  // Greece: 5 digits (e.g., 10431)
  'GR': /^\d{5}$/,
  
  // Ireland: Various formats, most common is alphanumeric (e.g., D02 AF30)
  'IE': /^[A-Z]\d{1,2}\s?[A-Z0-9]{4}$/i,
  
  // Hungary: 4 digits (e.g., 1011)
  'HU': /^\d{4}$/,
  
  // Romania: 6 digits (e.g., 010001)
  'RO': /^\d{6}$/,
  
  // Bulgaria: 4 digits (e.g., 1000)
  'BG': /^\d{4}$/,
  
  // Croatia: 5 digits (e.g., 10000)
  'HR': /^\d{5}$/,
  
  // Slovakia: 5 digits with optional space (e.g., 010 01 or 01001)
  'SK': /^\d{3}\s?\d{2}$/,
  
  // Slovenia: 4 digits (e.g., 1000)
  'SI': /^\d{4}$/,
  
  // Estonia: 5 digits (e.g., 10111)
  'EE': /^\d{5}$/,
  
  // Latvia: 4 digits with optional dash (e.g., LV-1001 or 1001)
  'LV': /^(LV-)?\d{4}$/i,
  
  // Lithuania: 5 digits with optional dash (e.g., LT-01101 or 01101)
  'LT': /^(LT-)?\d{5}$/i,
  
  // Cyprus: 4 digits (e.g., 1011)
  'CY': /^\d{4}$/,
  
  // Malta: 3-4 letters + 4 digits (e.g., VLT 1011)
  'MT': /^[A-Z]{3,4}\s?\d{4}$/i,
  
  // Luxembourg: 4 digits (e.g., 1010)
  'LU': /^\d{4}$/,
  
  // Iceland: 3 digits (e.g., 101)
  'IS': /^\d{3}$/,
  
  // Monaco: 5 digits (e.g., 98000)
  'MC': /^\d{5}$/,
  
  // Andorra: AD + 3 digits (e.g., AD100)
  'AD': /^AD\d{3}$/i,
  
  // San Marino: 5 digits (e.g., 47890)
  'SM': /^\d{5}$/,
  
  // Liechtenstein: 4 digits (e.g., 9490)
  'LI': /^\d{4}$/,
  
  // Vatican City: 00120
  'VA': /^00120$/,
  
  // Serbia: 5 digits (e.g., 11000)
  'RS': /^\d{5}$/,
  
  // Montenegro: 5 digits (e.g., 81000)
  'ME': /^\d{5}$/,
  
  // North Macedonia: 4 digits (e.g., 1000)
  'MK': /^\d{4}$/,
  
  // Albania: 4 digits (e.g., 1001)
  'AL': /^\d{4}$/,
  
  // Moldova: 4 digits (e.g., 2001)
  'MD': /^\d{4}$/,
  
  // Belarus: 6 digits (e.g., 220001)
  'BY': /^\d{6}$/,
  
  // Ukraine: 5 digits (e.g., 01001)
  'UA': /^\d{5}$/,
  
  // Turkey: 5 digits (e.g., 34000)
  'TR': /^\d{5}$/,
  
  // Kosovo: 5 digits (e.g., 10000)
  'XK': /^\d{5}$/,
} as const;

/**
 * Normalize country name to standard form
 */
export function normalizeEuropeanCountry(country: string): string | null {
  const normalized = country.toLowerCase().trim();
  
  // Check all European country names
  for (const [standardName, variations] of Object.entries(EUROPEAN_COUNTRY_NAMES)) {
    if (variations.some(v => normalized === v || normalized === `the ${v}`)) {
      return standardName;
    }
  }
  
  return null;
}

/**
 * Check if a country name is a valid European country
 */
export function isValidEuropeanCountry(country: string): boolean {
  return normalizeEuropeanCountry(country) !== null;
}

/**
 * Validate postcode format for a given country
 * If country is not provided, tries to validate against common European patterns
 */
export function validateEuropeanPostcode(postcode: string, country?: string): boolean {
  if (!postcode || !postcode.trim()) {
    return false;
  }
  
  const trimmedPostcode = postcode.trim();
  
  // If country is provided, use specific pattern
  if (country) {
    const normalizedCountry = normalizeEuropeanCountry(country);
    if (normalizedCountry) {
      // Find country code from normalized name
      const countryEntry = Object.entries(EUROPEAN_COUNTRY_NAMES).find(
        ([name]) => name === normalizedCountry
      );
      if (countryEntry) {
        const countryCode = Object.keys(EUROPEAN_COUNTRY_NAMES).indexOf(normalizedCountry) >= 0
          ? Object.keys(EUROPEAN_COUNTRY_NAMES)[Object.keys(EUROPEAN_COUNTRY_NAMES).indexOf(normalizedCountry)]
          : null;
        
        // Try to find country code from ISO codes
        for (const [code, names] of Object.entries(EUROPEAN_COUNTRY_NAMES)) {
          if (names.includes(normalizedCountry)) {
            const pattern = EUROPEAN_POSTCODE_PATTERNS[code.toUpperCase()];
            if (pattern) {
              return pattern.test(trimmedPostcode);
            }
          }
        }
      }
    }
  }
  
  // If no country or pattern not found, try all European patterns
  // This is more lenient but allows validation when country is unknown
  for (const pattern of Object.values(EUROPEAN_POSTCODE_PATTERNS)) {
    if (pattern.test(trimmedPostcode)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get country code from country name
 */
export function getCountryCode(countryName: string): string | null {
  const normalized = normalizeEuropeanCountry(countryName);
  if (!normalized) return null;
  
  // Map country names to ISO codes
  const countryCodeMap: Record<string, string> = {
    'albania': 'AL',
    'andorra': 'AD',
    'austria': 'AT',
    'belarus': 'BY',
    'belgium': 'BE',
    'bosnia and herzegovina': 'BA',
    'bulgaria': 'BG',
    'croatia': 'HR',
    'cyprus': 'CY',
    'czech republic': 'CZ',
    'denmark': 'DK',
    'estonia': 'EE',
    'finland': 'FI',
    'france': 'FR',
    'germany': 'DE',
    'greece': 'GR',
    'hungary': 'HU',
    'iceland': 'IS',
    'ireland': 'IE',
    'italy': 'IT',
    'kosovo': 'XK',
    'latvia': 'LV',
    'liechtenstein': 'LI',
    'lithuania': 'LT',
    'luxembourg': 'LU',
    'malta': 'MT',
    'moldova': 'MD',
    'monaco': 'MC',
    'montenegro': 'ME',
    'netherlands': 'NL',
    'north macedonia': 'MK',
    'norway': 'NO',
    'poland': 'PL',
    'portugal': 'PT',
    'romania': 'RO',
    'san marino': 'SM',
    'serbia': 'RS',
    'slovakia': 'SK',
    'slovenia': 'SI',
    'spain': 'ES',
    'sweden': 'SE',
    'switzerland': 'CH',
    'turkey': 'TR',
    'ukraine': 'UA',
    'united kingdom': 'GB',
    'vatican city': 'VA',
  };
  
  return countryCodeMap[normalized] || null;
}

/**
 * Extract postcode from text using European patterns
 */
export function extractEuropeanPostcode(text: string): string | null {
  if (!text) return null;
  
  // Try all European postcode patterns
  for (const pattern of Object.values(EUROPEAN_POSTCODE_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}
