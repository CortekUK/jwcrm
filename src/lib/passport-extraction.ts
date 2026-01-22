/**
 * Passport Number Extraction Utilities
 * Supports worldwide passport formats with focus on UK passports
 */

/**
 * Validates passport format - Universal for all countries
 */
export const isValidPassportFormat = (candidate: string): boolean => {
  // Must contain at least one alphanumeric character
  if (!/[A-Z0-9]/.test(candidate)) return false;

  // Length check: worldwide passports are typically 6-15 characters
  if (candidate.length < 6 || candidate.length > 15) return false;

  // Exclude obvious non-passport patterns
  if (/^(.)\1+$/.test(candidate)) return false; // Repeated: 11111111
  if (/^\d{4}$/.test(candidate)) return false; // 4-digit year
  if (/^(19|20)\d{2}$/.test(candidate)) return false; // Years: 1990, 2024
  if (/^\d{1,2}[A-Z]{3}\d{2,4}$/i.test(candidate)) return false; // Dates: 22JAN1974

  // Exclude sequential numbers (123456, 234567, etc.)
  const isSequential = (str: string): boolean => {
    if (!/^\d+$/.test(str)) return false;
    for (let i = 0; i < str.length - 1; i++) {
      const current = parseInt(str[i]);
      const next = parseInt(str[i + 1]);
      if (next !== current + 1 && next !== current - 1) return false;
    }
    return true;
  };
  if (isSequential(candidate)) return false;

  // Exclude common test patterns (111111, 123456, AAAAAA, etc.)
  if (/^(123456|654321|111111|222222|333333|444444|555555|666666|777777|888888|999999|000000)$/.test(candidate)) return false;
  if (/^[A]{6,}$/.test(candidate)) return false; // All A's

  // Exclude common English words that look like passport numbers
  const commonWords = /^(STATES|UNITED|UNTIED|AMERICA|PASSPORT|SURNAME|NUMBER|ADDRESS|DOCUMENT|NATIONALITY|SIGNATURE|HOLDER|GIVEN|NAMES|DATE|BIRTH|PLACE|ISSUE|EXPIRY|AUTHORITY|VALID|UNTIL|SEX|MALE|FEMALE|TYPE|CODE|COUNTRY|REGION|HEIGHT|EYES|HAIR|BRITISH|CITIZEN|KINGDOM)$/i;
  if (commonWords.test(candidate)) return false;

  // MUST have at least one digit - passports always have numbers
  if (!/\d/.test(candidate)) return false;

  // UK passport format is VERY strict: 9 characters, format: [0-9]{9} OR [A-Z]{2}[0-9]{7}
  // Most UK passports are 9 digits or 2 letters + 7 digits
  const isUKFormat = /^([A-Z]{2}[0-9]{7}|[0-9]{9})$/.test(candidate);
  if (candidate.length === 9 && !isUKFormat) {
    // If it's 9 characters but doesn't match UK format, check if it has letters
    // UK passports with letters MUST be 2 letters + 7 digits (e.g., AB1234567)
    if (/[A-Z]/.test(candidate) && !/^[A-Z]{2}[0-9]{7}$/.test(candidate)) {
      return false; // Not a valid UK format
    }
  }

  // Universal passport patterns (covers 99% of worldwide formats)
  const validPatterns = [
    /^[0-9]{6,15}$/,                    // Numeric only (China, India, Pakistan, etc.)
    /^[A-Z]{1,4}[0-9]{5,12}$/,          // Letter(s) + numbers (UK, USA, Canada, etc.)
    /^[0-9]{1,4}[A-Z]{1,4}[0-9]{3,12}$/, // Numbers + letters + numbers (France, Benin, etc.)
    /^[A-Z0-9]{6,15}$/,                 // Mixed alphanumeric (fallback for any format)
  ];

  return validPatterns.some(pattern => pattern.test(candidate));
};

/**
 * Extracts passport number from OCR text
 * Optimized for UK passports but supports worldwide formats
 */
export const extractPassportNumberFromText = (text: string): string | null => {
  console.log("📝 Extracting passport number from OCR text...");
  console.log("Full extracted text:", text);

  // Preprocess text - handle common OCR errors
  let cleanedText = text
    .replace(/[|!]/g, 'I') // Pipe and exclamation often misread as I
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // First, try to find passport number with explicit labels (most reliable)
  const labelPatterns = [
    // Standard formats: "PASSPORT NO: ABC123456", "PASSEPORT N°: 21TP00077"
    /(?:PASSPORT|PASSEPORT|PASAPORTE|PASZPORT|REISEPASS|جواز السفر|N°\s*PASSPORT|N°\s*PASSEPORT)[\s:°\.]*(?:NO\.?|N°|NUMBER|NUMERO|NUM|NR|NUMER)?[\s:°\.]*([A-Z0-9]{6,15})/gi,
    // Document number field
    /(?:DOCUMENT|DOC)[\s:°\.]*(?:NO\.?|N°|NUMBER)?[\s:°\.]*([A-Z0-9]{6,15})/gi,
    // Line starting with NO/NUM: "NO: ABC123"
    /(?:^|\n)[\s]*(?:NO\.?|N°|NUM\.?|NR\.?)[\s:°\.]+([A-Z0-9]{6,15})/gim,
    // Passport/Passeport followed by number on same or next line
    /(?:PASSPORT|PASSEPORT)[\s\n]+([A-Z0-9]{6,15})/gi,
    // French format: "N° " followed by number
    /N°[\s:°\.]*([A-Z0-9]{6,15})/gi,
  ];

  for (const pattern of labelPatterns) {
    const matches = cleanedText.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && /[A-Z0-9]/.test(match[1])) {
        const candidate = match[1].trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        // Exclude dates, pure letter sequences, and repeated characters
        if (
          !/^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(candidate) &&
          !/^[A-Z]{6,}$/.test(candidate) &&
          !/^(.)\1+$/.test(candidate) &&
          !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/.test(candidate) &&
          candidate.length >= 6 &&
          candidate.length <= 15 &&
          isValidPassportFormat(candidate)
        ) {
          console.log("✅ Found with label pattern:", candidate);
          return candidate;
        }
      }
    }
  }

  // Machine Readable Zone (MRZ) - bottom of passport
  // Try to find MRZ lines directly
  const lines = cleanedText.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // MRZ second line typically starts with passport number (8-9 digits/chars)
    // followed by check digit, country code (3 letters), then birth date (6-7 digits)
    const mrzSecondLineMatch = line.match(/^([A-Z0-9]{8,9})[0-9<]?[A-Z]{3}[0-9]{6,7}/);
    if (mrzSecondLineMatch && mrzSecondLineMatch[1]) {
      const candidate = mrzSecondLineMatch[1];
      if (isValidPassportFormat(candidate)) {
        console.log("✅ Found passport in MRZ second line:", candidate);
        return candidate;
      }
    }
  }

  const mrzPatterns = [
    // Second line format: 31195654USA1234567M...
    /^([A-Z0-9]{8,9})[0-9<]?[A-Z]{3}[0-9]{6,7}/m,
    // Standard MRZ second line with check digit
    /([A-Z0-9]{9})<+[0-9]{1}[A-Z]{3}[0-9]{7}</,
    // Passport number followed by chevrons
    /([A-Z0-9]{6,9})<<<+/,
    // P< format with country code
    /P<[A-Z]{3}([A-Z0-9<]{9,})/,
    // First line P<USA... then second line starts with passport number
    /P<[A-Z]{3}[^<\n]*<+\s*([A-Z0-9]{6,9})/i,
  ];

  for (const pattern of mrzPatterns) {
    const mrzMatch = cleanedText.match(pattern);
    if (mrzMatch && mrzMatch[1]) {
      const passportNum = mrzMatch[1].replace(/<+/g, "").trim();
      if (passportNum.length >= 6 && passportNum.length <= 12 && /[A-Z0-9]/.test(passportNum) && isValidPassportFormat(passportNum)) {
        console.log("✅ Found in MRZ pattern:", passportNum);
        return passportNum;
      }
    }
  }

  // Universal worldwide passport number patterns (ordered by specificity)
  // Focus on UK format first (2 letters + 7 digits or 9 digits)
  const numberPatterns = [
    // UK SPECIFIC PATTERNS (highest priority)
    /\b([A-Z]{2}[0-9]{7})\b/,  // AB1234567 - UK, Germany, Spain (most common UK format)
    /\b([0-9]{9})\b/,   // 9 digits - UK numeric passports, India, Philippines, Bangladesh

    // === NUMERIC ONLY FORMATS (6-15 digits) ===
    /\b([0-9]{15})\b/, /\b([0-9]{14})\b/, /\b([0-9]{13})\b/, /\b([0-9]{12})\b/,
    /\b([0-9]{11})\b/, /\b([0-9]{10})\b/, /\b([0-9]{8})\b/, /\b([0-9]{7})\b/, /\b([0-9]{6})\b/,

    // === LETTERS + NUMBERS FORMATS ===
    /\b([A-Z]{1}[0-9]{12})\b/, /\b([A-Z]{1}[0-9]{11})\b/, /\b([A-Z]{1}[0-9]{10})\b/,
    /\b([A-Z]{1}[0-9]{9})\b/, /\b([A-Z]{1}[0-9]{8})\b/, /\b([A-Z]{1}[0-9]{7})\b/,
    /\b([A-Z]{1}[0-9]{6})\b/, /\b([A-Z]{1}[0-9]{5})\b/,

    /\b([A-Z]{2}[0-9]{10})\b/, /\b([A-Z]{2}[0-9]{9})\b/, /\b([A-Z]{2}[0-9]{8})\b/,
    /\b([A-Z]{2}[0-9]{6})\b/, /\b([A-Z]{2}[0-9]{5})\b/,

    /\b([A-Z]{3}[0-9]{9})\b/, /\b([A-Z]{3}[0-9]{8})\b/, /\b([A-Z]{3}[0-9]{7})\b/,
    /\b([A-Z]{3}[0-9]{6})\b/, /\b([A-Z]{3}[0-9]{5})\b/,

    /\b([A-Z]{4}[0-9]{8})\b/, /\b([A-Z]{4}[0-9]{7})\b/, /\b([A-Z]{4}[0-9]{6})\b/,
    /\b([A-Z]{4}[0-9]{5})\b/,

    // === NUMBERS + LETTERS + NUMBERS FORMATS ===
    /\b([0-9]{1}[A-Z]{1}[0-9]{10})\b/, /\b([0-9]{1}[A-Z]{1}[0-9]{9})\b/,
    /\b([0-9]{1}[A-Z]{1}[0-9]{8})\b/, /\b([0-9]{1}[A-Z]{1}[0-9]{7})\b/,
    /\b([0-9]{1}[A-Z]{1}[0-9]{6})\b/, /\b([0-9]{1}[A-Z]{1}[0-9]{5})\b/,

    /\b([0-9]{2}[A-Z]{1}[0-9]{9})\b/, /\b([0-9]{2}[A-Z]{1}[0-9]{8})\b/,
    /\b([0-9]{2}[A-Z]{1}[0-9]{7})\b/, /\b([0-9]{2}[A-Z]{1}[0-9]{6})\b/,
    /\b([0-9]{2}[A-Z]{1}[0-9]{5})\b/,

    /\b([0-9]{2}[A-Z]{2}[0-9]{8})\b/, /\b([0-9]{2}[A-Z]{2}[0-9]{7})\b/,
    /\b([0-9]{2}[A-Z]{2}[0-9]{6})\b/, /\b([0-9]{2}[A-Z]{2}[0-9]{5})\b/,
    /\b([0-9]{2}[A-Z]{2}[0-9]{4})\b/,

    /\b([0-9]{2}[A-Z]{3}[0-9]{7})\b/, /\b([0-9]{2}[A-Z]{3}[0-9]{6})\b/,
    /\b([0-9]{2}[A-Z]{3}[0-9]{5})\b/,

    /\b([0-9]{3}[A-Z]{2}[0-9]{7})\b/, /\b([0-9]{3}[A-Z]{2}[0-9]{6})\b/,
    /\b([0-9]{3}[A-Z]{2}[0-9]{5})\b/,

    /\b([0-9]{4}[A-Z]{2}[0-9]{6})\b/, /\b([0-9]{4}[A-Z]{2}[0-9]{5})\b/,

    // === GENERIC ALPHANUMERIC (Fallback for unusual formats) ===
    /\b([A-Z0-9]{15})\b/, /\b([A-Z0-9]{14})\b/, /\b([A-Z0-9]{13})\b/,
    /\b([A-Z0-9]{12})\b/, /\b([A-Z0-9]{11})\b/, /\b([A-Z0-9]{10})\b/,
    /\b([A-Z0-9]{8})\b/, /\b([A-Z0-9]{7})\b/, /\b([A-Z0-9]{6})\b/,
  ];

  const candidates: string[] = [];
  for (const pattern of numberPatterns) {
    const matches = cleanedText.matchAll(new RegExp(pattern, "gi"));
    for (const match of matches) {
      if (match[1]) {
        const candidate = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Use the universal validation function
        if (isValidPassportFormat(candidate)) {
          candidates.push(candidate);
        }
      }
    }
  }

  if (candidates.length > 0) {
    console.log("All candidates found:", candidates);

    // Use frequency analysis to find the most common candidate
    const frequency: Record<string, number> = {};
    candidates.forEach((c) => {
      frequency[c] = (frequency[c] || 0) + 1;
    });
    const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
    console.log("Candidate frequency:", sorted);

    console.log("✅ Best candidate:", sorted[0][0]);
    return sorted[0][0];
  }

  console.log("❌ No valid passport number found");
  return null;
};
