import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract text from passport image using OCR.space API
 * Free tier: 25,000 requests/month - No signup required for basic usage
 */
async function extractTextFromImage(imageUrl: string): Promise<string> {
  console.log('Calling OCR.space API...');

  // Using OCR.space free API key (public, rate-limited)
  // For production, get your own key at: https://ocr.space/ocrapi
  const OCR_API_KEY = Deno.env.get('OCR_SPACE_API_KEY') || 'K87899142388957';

  const formData = new FormData();
  formData.append('url', imageUrl);
  formData.append('apikey', OCR_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Engine 2 is better for documents

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR API failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.IsErroredOnProcessing) {
    throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
  }

  const extractedText = result.ParsedResults?.[0]?.ParsedText || '';
  console.log('OCR completed');

  return extractedText;
}

/**
 * Validate passport format
 */
function isValidPassportFormat(candidate: string): boolean {
  if (!/[A-Z0-9]/.test(candidate)) return false;

  // Length check: most passports are 6-12 characters
  if (candidate.length < 6 || candidate.length > 12) return false;

  const validPatterns = [
    /^[0-9]{2}[A-Z]{2}[0-9]{5}$/,     // 21TP00077
    /^[A-Z]{2}[0-9]{6,9}$/,           // AB123456, AB1234567, AB12345678
    /^[A-Z][0-9]{7,9}$/,              // A1234567, C12345678, A123456789
    /^[0-9]{8,10}$/,                  // 12345678, 123456789, 1234567890
    /^[0-9]{1,3}[A-Z]{1,3}[0-9]{4,7}$/, // 12AB34567
    /^[A-Z]{3}[0-9]{6,9}$/,           // ABC123456, ABC1234567
  ];

  return validPatterns.some(pattern => pattern.test(candidate));
}

/**
 * Extract passport number from text using regex patterns
 * Enhanced with better OCR error handling and worldwide formats
 */
function extractPassportNumber(text: string): string | null {
  console.log('Extracting passport from text length:', text.length);

  // Preprocess text - handle common OCR errors
  let cleanedText = text
    .replace(/[|!]/g, 'I') // Pipe and exclamation often misread as I
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // First, try to find passport number with explicit labels (most reliable)
  const labelPatterns = [
    // Standard formats: "PASSPORT NO: ABC123456", "PASSEPORT N°: 21TP00077"
    /(?:PASSPORT|PASSEPORT|PASAPORTE|PASZPORT|REISEPASS|N°\s*PASSPORT|N°\s*PASSEPORT)[\s:°\.]*(?:NO\.?|N°|NUMBER|NUMERO|NUM|NR|NUMER)?[\s:°\.]*([A-Z0-9]{6,15})/gi,
    // Document number field
    /(?:DOCUMENT|DOC)[\s:°\.]*(?:NO\.?|N°|NUMBER)?[\s:°\.]*([A-Z0-9]{6,15})/gi,
    // Line starting with NO/NUM: "NO: ABC123"
    /(?:^|\n)[\s]*(?:NO\.?|N°|NUM\.?|NR\.?)[\s:°\.]+([A-Z0-9]{6,15})/gim,
    // Passport followed by number
    /(?:PASSPORT|PASSEPORT)[\s\n]+([A-Z0-9]{6,15})/gi,
    // French format: "N° " followed by number
    /N°[\s:°\.]*([A-Z0-9]{6,15})/gi,
  ];

  for (const pattern of labelPatterns) {
    const matches = cleanedText.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && /[A-Z0-9]/.test(match[1])) {
        const candidate = match[1].trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (
          !/^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(candidate) &&
          !/^[A-Z]{6,}$/.test(candidate) &&
          !/^(.)\1+$/.test(candidate) &&
          !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/.test(candidate) &&
          candidate.length >= 6 &&
          candidate.length <= 15 &&
          isValidPassportFormat(candidate)
        ) {
          console.log('✅ Found with label pattern:', candidate);
          return candidate;
        }
      }
    }
  }

  // Machine Readable Zone (MRZ) - bottom of passport
  // MRZ second line format: PassportNumber + Country + BirthDate + Sex + ExpiryDate + Nationality + OptionalData
  // Example: 31195654USA1234567M1234567890123456<123456

  // Try to find MRZ lines directly
  const lines = cleanedText.split(/[\n\r]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // MRZ second line typically starts with passport number (8-9 digits/chars)
    // followed by check digit, country code (3 letters), then birth date (6-7 digits)
    const mrzSecondLineMatch = line.match(/^([A-Z0-9]{8,9})[0-9<]?[A-Z]{3}[0-9]{6,7}/);
    if (mrzSecondLineMatch && mrzSecondLineMatch[1]) {
      const candidate = mrzSecondLineMatch[1];
      console.log('✅ Found passport in MRZ second line:', candidate);
      return candidate;
    }
  }

  // Machine Readable Zone (MRZ) patterns
  const mrzPatterns = [
    // Second line format: 31195654USA1234567M...
    /^([A-Z0-9]{8,9})[0-9<]?[A-Z]{3}[0-9]{6,7}/m,  // Passport# + check + Country + Birth date
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
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      const passportNum = match[1].replace(/<+/g, '').trim();
      if (passportNum.length >= 6 && passportNum.length <= 12 && /[A-Z0-9]/.test(passportNum)) {
        console.log('✅ Found in MRZ pattern:', passportNum);
        return passportNum;
      }
    }
  }

  // Worldwide passport number patterns
  const numberPatterns = [
    /\b([0-9]{2}[A-Z]{2}[0-9]{5})\b/,
    /\b([A-Z]{2}[0-9]{7})\b/,
    /\b([C][0-9]{7,8})\b/,
    /\b([0-9]{9})\b/,
    /\b([0-9]{8})\b/,
    /\b([A-Z]{2}[0-9]{6})\b/,
    /\b([A-Z][0-9]{7,8})\b/,
    /\b([0-9]{1,3}[A-Z]{1,3}[0-9]{4,7})\b/,
    /\b([A-Z]{2}[0-9]{8})\b/,
    /\b([A-Z]{3}[0-9]{6})\b/,
  ];

  const candidates: string[] = [];
  for (const pattern of numberPatterns) {
    const matches = cleanedText.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match[1]) {
        const candidate = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (
          !/^\d{4}$/.test(candidate) &&
          !/^\d{2}[\/\-]\d{2}$/.test(candidate) &&
          !/^[A-Z]{6,}$/.test(candidate) &&
          !/^[0-9]{1,5}$/.test(candidate) &&
          !/^(\d)\1+$/.test(candidate) &&
          !/^(BEN|USA|GBR|FRA|DEU|ITA|ESP|PRT|NLD|BEL|CHE|AUT|SWE|NOR|DNK|FIN|POL|CZE|HUN|GRC|TUR|RUS|CHN|JPN|KOR|IND|PAK|BGD|IDN|THA|VNM|PHL|MYS|SGP|AUS|NZL|CAN|MEX|BRA|ARG|CHL|COL|PER|VEN|ZAF|EGY|NGA|KEN|GHA|ETH|UGA|TZA|MAR|DZA|TUN|SEN|CIV|CMR|NER|BFA|MLI|GIN|BEN|TGO|SLE|LBR|MRT|GMB|GNB|GNQ|GAB|COG|CAF|TCD|SDN|SSD|SOM|DJI|ERI|RWA|BDI)$/i.test(candidate)
        ) {
          if (/[A-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
            candidates.push(candidate);
          } else if (/^[0-9]{8,10}$/.test(candidate)) {
            candidates.push(candidate);
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    console.log('All candidates:', candidates);
    const frequency: Record<string, number> = {};
    candidates.forEach((c) => {
      frequency[c] = (frequency[c] || 0) + 1;
    });
    const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
    console.log('✅ Best candidate:', sorted[0][0]);
    return sorted[0][0];
  }

  console.log('❌ No valid passport number found');
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    const { file_path, will_id } = await req.json();

    if (!file_path) {
      throw new Error('file_path is required');
    }

    console.log('Extracting passport number from:', file_path);

    // Get signed URL for the image
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('wills')
      .createSignedUrl(file_path, 600); // 10 minutes

    if (urlError || !signedUrlData?.signedUrl) {
      throw new Error('Failed to get signed URL for image');
    }

    console.log('Got signed URL, calling OCR...');

    // Extract text from image
    const extractedText = await extractTextFromImage(signedUrlData.signedUrl);
    console.log('Extracted text:', extractedText.substring(0, 200)); // Log first 200 chars

    // Extract passport number from text
    const passportNumber = extractPassportNumber(extractedText);

    console.log('Extracted passport number:', passportNumber || 'NOT FOUND');

    // If we have a will_id, update the will's answers with the passport number
    if (will_id && passportNumber) {
      const { data: will } = await supabase
        .from('wills')
        .select('answers')
        .eq('id', will_id)
        .single();

      if (will) {
        const answers = (will.answers as any) || {};
        const identity = answers.identity || {};

        const updatedAnswers = {
          ...answers,
          identity: {
            ...identity,
            passport_number: passportNumber,
          },
        };

        await supabase
          .from('wills')
          .update({ answers: updatedAnswers })
          .eq('id', will_id);

        console.log('Updated will with passport number');
      }
    }

    // If no passport number was found, return an error
    if (!passportNumber) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Could not extract passport number from image',
          passport_number: null,
          extracted_text: extractedText.substring(0, 500), // For debugging
          message: 'Please enter your passport number manually',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 422, // Unprocessable Entity
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        passport_number: passportNumber,
        extracted_text: extractedText.substring(0, 500), // Return first 500 chars for debugging
        message: 'Passport number extracted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in extract-passport-number:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
        passport_number: null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
