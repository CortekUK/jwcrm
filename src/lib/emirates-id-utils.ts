/**
 * Emirates ID OCR Extraction Utilities
 *
 * Emirates ID format: 784-YYYY-XXXXXXX-X
 * - 784: Country code (UAE)
 * - YYYY: Year (4 digits)
 * - XXXXXXX: Sequence number (7 digits)
 * - X: Check digit (1 digit)
 *
 * Total: 15 digits with dashes, or 15 digits without dashes
 */

/**
 * Validates Emirates ID format
 */
export const isValidEmiratesIdFormat = (candidate: string): boolean => {
  // Remove dashes for validation
  const cleaned = candidate.replace(/-/g, '');

  // Must be exactly 15 digits
  if (!/^\d{15}$/.test(cleaned)) return false;

  // Must start with 784 (UAE country code)
  if (!cleaned.startsWith('784')) return false;

  // Year part (positions 3-6) should be reasonable (1900-2100)
  const yearPart = cleaned.substring(3, 7);
  const year = parseInt(yearPart);
  if (year < 1900 || year > 2100) return false;

  // Exclude obvious test patterns
  if (/^(.)\1+$/.test(cleaned)) return false; // All same digit
  if (cleaned === '784000000000000') return false; // Zero pattern

  return true;
};

/**
 * Formats Emirates ID with dashes
 */
export const formatEmiratesId = (id: string): string => {
  const cleaned = id.replace(/-/g, '');
  if (cleaned.length !== 15) return id;

  return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 7)}-${cleaned.substring(7, 14)}-${cleaned.substring(14)}`;
};

/**
 * Extracts Emirates ID from OCR text
 */
export const extractEmiratesIdFromText = (text: string): string | null => {
  console.log('📝 Extracting Emirates ID from OCR text...');

  // Preprocess text - handle common OCR errors
  let cleanedText = text
    .replace(/[|!]/g, 'I')
    .replace(/[Oo]/g, '0') // In ID numbers, O is usually 0
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern 1: Look for explicit labels
  const labelPatterns = [
    /(?:EMIRATES|EMARAT|ID|IDENTITY|رقم الهوية|بطاقة الهوية)[\s:]*(?:NO\.?|NUMBER|NUM)?[\s:]*(\d{3}[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d)/gi,
    /(?:CARD|بطاقة)[\s:]*(?:NO\.?|NUMBER)?[\s:]*(\d{3}[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d)/gi,
    /(?:^|\n)[\s]*(?:NO\.?|NUM\.?|رقم)[\s:]+(\d{3}[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d)/gim,
  ];

  for (const pattern of labelPatterns) {
    const matches = cleanedText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const candidate = match[1].replace(/[-\s]/g, '');
        if (isValidEmiratesIdFormat(candidate)) {
          console.log('✅ Found Emirates ID with label:', formatEmiratesId(candidate));
          return formatEmiratesId(candidate);
        }
      }
    }
  }

  // Pattern 2: Look for 784-YYYY-XXXXXXX-X format (with dashes)
  const dashedPattern = /\b(784[-\s]\d{4}[-\s]\d{7}[-\s]\d)\b/g;
  const dashedMatches = cleanedText.matchAll(dashedPattern);
  for (const match of dashedMatches) {
    const candidate = match[1].replace(/[-\s]/g, '');
    if (isValidEmiratesIdFormat(candidate)) {
      console.log('✅ Found Emirates ID (dashed format):', formatEmiratesId(candidate));
      return formatEmiratesId(candidate);
    }
  }

  // Pattern 3: Look for 784 followed by 12 digits (no dashes)
  const noDashPattern = /\b(784\d{12})\b/g;
  const noDashMatches = cleanedText.matchAll(noDashPattern);
  for (const match of noDashMatches) {
    const candidate = match[1];
    if (isValidEmiratesIdFormat(candidate)) {
      console.log('✅ Found Emirates ID (no dashes):', formatEmiratesId(candidate));
      return formatEmiratesId(candidate);
    }
  }

  // Pattern 4: Look for any 15-digit sequence starting with 784
  const anyPattern = /\b(784\d{4}\d{7}\d)\b/g;
  const anyMatches = cleanedText.matchAll(anyPattern);
  for (const match of anyMatches) {
    const candidate = match[1];
    if (isValidEmiratesIdFormat(candidate)) {
      console.log('✅ Found Emirates ID (generic pattern):', formatEmiratesId(candidate));
      return formatEmiratesId(candidate);
    }
  }

  // Pattern 5: Search line by line for better accuracy
  const lines = cleanedText.split(/[\n\r]+/);
  for (const line of lines) {
    // Look for 15 consecutive digits starting with 784
    const lineMatch = line.match(/784\d{12}/);
    if (lineMatch) {
      const candidate = lineMatch[0];
      if (isValidEmiratesIdFormat(candidate)) {
        console.log('✅ Found Emirates ID (line-by-line):', formatEmiratesId(candidate));
        return formatEmiratesId(candidate);
      }
    }
  }

  console.log('❌ No valid Emirates ID found');
  return null;
};

/**
 * Extracts name from Emirates ID OCR text
 * Prefers Arabic name over English if both are present
 * Common patterns: "Name: John Doe", "الاسم: أحمد محمد", or name appearing near ID
 */
export const extractNameFromEmiratesIdText = (text: string): string | null => {
  console.log('📝 Extracting name from OCR text...');
  console.log('OCR Text:', text);

  // Preprocess text
  const cleanedText = text.trim();
  const lines = cleanedText.split(/[\n\r]+/);

  let arabicName: string | null = null;
  let englishName: string | null = null;

  // Pattern 1: Look for explicit Arabic name labels (PRIORITY)
  const arabicLabelPatterns = [
    /(?:الاسم|الإسم|اسم حامل البطاقة)[\s:]*([ء-ي\s]{3,50})/gi,
    /(?:NAME|HOLDER|CARDHOLDER)[\s:]*([ء-ي\s]{3,50})/gi,
  ];

  console.log('Searching for Arabic name labels...');
  for (const pattern of arabicLabelPatterns) {
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      console.log('Found Arabic text with label:', extractedName);
      // Validate: name should be at least 2 words and not contain numbers
      if (extractedName.length >= 3 && !/\d/.test(extractedName)) {
        const words = extractedName.split(/\s+/).filter(w => w.length > 0);
        if (words.length >= 2 && words.length <= 5) {
          console.log('✅ Found Arabic name with label:', extractedName);
          arabicName = extractedName;
          break;
        } else {
          console.log('Arabic text has wrong word count:', words.length);
        }
      }
    }
  }

  // Pattern 2: Look for Arabic names in lines (if not found with label)
  if (!arabicName) {
    console.log('Searching for Arabic text in lines...');
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i].trim();
      console.log(`Line ${i}:`, line);

      // Skip lines with Emirates ID numbers or common English keywords
      if (/784|\d{3,}|EMIRATES|IDENTITY|CARD|EXPIRY|DATE/i.test(line)) {
        console.log('Skipping line (contains keywords)');
        continue;
      }

      // Look for Arabic text (at least 2 words)
      // Arabic Unicode range: \u0600-\u06FF
      const arabicMatch = line.match(/[\u0600-\u06FF\s]{6,50}/);
      if (arabicMatch) {
        const extractedName = arabicMatch[0].trim();
        console.log('Found Arabic text:', extractedName);
        const words = extractedName.split(/\s+/).filter(w => w.length > 1);
        console.log('Arabic words:', words, 'count:', words.length);

        if (words.length >= 2 && words.length <= 5) {
          console.log('✅ Found Arabic name in line:', extractedName);
          arabicName = extractedName;
          break;
        }
      }
    }
  }

  // If Arabic name found, return it (preferred)
  if (arabicName) {
    return arabicName;
  }

  // Pattern 3: Look for English name labels (fallback) - look for "Name:" specifically
  // Extract text after "Name:" and clean it up
  const nameLineMatch = cleanedText.match(/Name:\s*([^\n]+)/i);

  if (nameLineMatch && nameLineMatch[1]) {
    const nameLine = nameLineMatch[1].trim();
    console.log('Found line after "Name:":', nameLine);

    // Extract only valid title-case words, stop at OCR garbage
    const validWords: string[] = [];
    const words = nameLine.split(/\s+/);

    for (const word of words) {
      // Check if word looks like a name (starts with capital, has lowercase, no weird patterns)
      const isValidNameWord = /^[A-Z][a-z]{1,15}$/.test(word);
      const isOCRGarbage = /BAILL|dupyalf|SfyLoYI|dad|FOTORNR|ION|EAE|ey/i.test(word);

      if (isValidNameWord && !isOCRGarbage) {
        validWords.push(word);
      } else {
        // Stop at first invalid word
        console.log('Stopped at invalid word:', word);
        break;
      }

      // Stop if we have enough words (max 4)
      if (validWords.length >= 4) break;
    }

    if (validWords.length >= 2 && validWords.length <= 4) {
      englishName = validWords.join(' ');
      console.log('✅ Found English name with "Name:" label:', englishName);
    } else {
      console.log('Not enough valid words:', validWords);
    }
  }

  // Additional fallback patterns
  if (!englishName) {
    const englishLabelPatterns = [
      /(?:Full Name|HOLDER|CARDHOLDER)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    ];

    for (const pattern of englishLabelPatterns) {
      const matches = Array.from(cleanedText.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) {
          const extractedName = match[1].trim();
          const words = extractedName.split(/\s+/).filter(w => w.length > 0);

          const hasOCRErrors = words.some(w =>
            /[BCDFGHJKLMNPQRSTVWXYZ]{5,}/i.test(w) ||
            /FOTORNR|ION|EAE|BAILL/i.test(w)
          );

          if (words.length >= 2 && words.length <= 5 &&
              !/\d/.test(extractedName) &&
              !hasOCRErrors) {
            console.log('✅ Found English name with label:', extractedName);
            englishName = extractedName;
            break;
          }
        }
      }
      if (englishName) break;
    }
  }

  // Pattern 4: Look for capitalized English names (fallback)
  if (!englishName) {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();

      // Skip lines that contain "EMIRATES" or "IDENTITY" or numbers or common OCR errors
      if (/EMIRATES|IDENTITY|CARD|784|\d{3,}|EXPIRY|DATE|NATIONALITY|BAILL|FOTORNR/i.test(line)) continue;

      // Look for fully capitalized multi-word names
      const capitalizedMatch = line.match(/\b([A-Z][A-Z\s]{5,50})\b/);
      if (capitalizedMatch) {
        const extractedName = capitalizedMatch[1].trim();
        const words = extractedName.split(/\s+/).filter(w => w.length > 1);

        // Valid name should have 2-5 words, each at least 2 chars
        // Filter out common OCR errors (names with unusual character patterns)
        const hasOCRErrors = words.some(w =>
          // Words with too many consonants in a row (likely OCR errors)
          /[BCDFGHJKLMNPQRSTVWXYZ]{5,}/i.test(w) ||
          // Words with unusual character combinations
          /[XQ]{2,}|NR|RN[ABCDFG]|ION EAE/i.test(w)
        );

        if (words.length >= 2 && words.length <= 5 &&
            words.every(w => w.length >= 2) &&
            !hasOCRErrors) {
          console.log('✅ Found capitalized English name:', extractedName);
          englishName = extractedName;
          break;
        }
      }
    }
  }

  // Return English name if no Arabic found
  if (englishName) {
    return englishName;
  }

  console.log('❌ No valid name found');
  return null;
};

/**
 * Validates a manual Emirates ID entry
 */
export const validateEmiratesIdInput = (value: string): { valid: boolean; message?: string } => {
  if (!value || value.trim() === '') {
    return { valid: false, message: 'Emirates ID is required' };
  }

  const cleaned = value.replace(/-/g, '');

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: 'Emirates ID must contain only digits' };
  }

  if (cleaned.length !== 15) {
    return { valid: false, message: 'Emirates ID must be exactly 15 digits' };
  }

  if (!cleaned.startsWith('784')) {
    return { valid: false, message: 'Emirates ID must start with 784' };
  }

  if (!isValidEmiratesIdFormat(cleaned)) {
    return { valid: false, message: 'Invalid Emirates ID format' };
  }

  return { valid: true };
};
