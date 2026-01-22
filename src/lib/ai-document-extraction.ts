/**
 * AI-Based Document Extraction using OpenAI GPT-4 Vision
 *
 * This module provides intelligent extraction from employee documents:
 * - Passport: Expiry date, passport number, full name
 * - Employment Visa: Expiry date, visa number
 * - Emirates ID: Expiry date, ID number, Arabic name, English name
 * - Employment Contract: Expiry date (if fixed-term), contract type
 */

import OpenAI from 'openai';

// Document types supported
export type DocumentType = 'passport' | 'employment_visa' | 'emirates_id' | 'employment_contract';

// Base extraction result
interface BaseExtractionResult {
  expiryDate: string | null; // Format: YYYY-MM-DD
  extractionMethod: 'ai' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

// Passport extraction result
export interface PassportExtractionResult extends BaseExtractionResult {
  documentType: 'passport';
  passportNumber: string | null;
  fullName: string | null;
  nationality: string | null;
}

// Visa extraction result
export interface VisaExtractionResult extends BaseExtractionResult {
  documentType: 'employment_visa';
  visaNumber: string | null;
  visaType: string | null;
}

// Emirates ID extraction result
export interface EmiratesIdExtractionResult extends BaseExtractionResult {
  documentType: 'emirates_id';
  emiratesId: string | null;
  arabicName: string | null;
  englishName: string | null;
}

// Employment Contract extraction result
export interface ContractExtractionResult extends BaseExtractionResult {
  documentType: 'employment_contract';
  contractType: 'fixed_term' | 'unlimited' | null;
  startDate: string | null;
}

// Union type for all extraction results
export type DocumentExtractionResult =
  | PassportExtractionResult
  | VisaExtractionResult
  | EmiratesIdExtractionResult
  | ContractExtractionResult;

/**
 * Convert File or Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1] || base64String;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get the extraction prompt based on document type
 */
function getExtractionPrompt(documentType: DocumentType): string {
  const prompts: Record<DocumentType, string> = {
    passport: `You are an expert at extracting information from passports.

Please analyze this passport image and extract the following information:

1. **Expiry Date**: The passport expiration date (look for "Date of Expiry" or similar)
2. **Passport Number**: The unique passport number
3. **Full Name**: The holder's full name
4. **Nationality**: The nationality/country

IMPORTANT INSTRUCTIONS:
- For dates, use ISO format: YYYY-MM-DD
- Look for the Machine Readable Zone (MRZ) at the bottom for accurate data
- Return ONLY valid data, use null for any field you cannot confidently extract

Return your response in this exact JSON format:
{
  "expiryDate": "YYYY-MM-DD or null",
  "passportNumber": "passport number or null",
  "fullName": "FULL NAME or null",
  "nationality": "country or null",
  "confidence": "high or medium or low"
}

Do not include any explanations, only return the JSON object.`,

    employment_visa: `You are an expert at extracting information from UAE employment visas.

Please analyze this employment visa image and extract the following information:

1. **Expiry Date**: The visa expiration date
2. **Visa Number**: The unique visa/permit number
3. **Visa Type**: The type of visa (employment, residence, etc.)

IMPORTANT INSTRUCTIONS:
- For dates, use ISO format: YYYY-MM-DD
- UAE visas may have dates in Arabic or English
- Look for "Valid Until", "Expiry Date", or "تاريخ الانتهاء"
- Return ONLY valid data, use null for any field you cannot confidently extract

Return your response in this exact JSON format:
{
  "expiryDate": "YYYY-MM-DD or null",
  "visaNumber": "visa number or null",
  "visaType": "type or null",
  "confidence": "high or medium or low"
}

Do not include any explanations, only return the JSON object.`,

    emirates_id: `You are an expert at extracting information from UAE Emirates ID cards.

Please analyze this Emirates ID card image and extract the following information:

1. **Expiry Date**: The ID card expiration date (look for "Expiry Date" or "تاريخ الانتهاء")
2. **Emirates ID Number**: Format is 784-YYYY-XXXXXXX-X (15 digits total, starts with 784)
3. **Arabic Name**: The full name in Arabic script (الاسم)
4. **English Name**: The full name in English/Latin script

IMPORTANT INSTRUCTIONS:
- For dates, use ISO format: YYYY-MM-DD
- The Emirates ID has BOTH Arabic and English names printed on it
- The expiry date is usually on the front of the card
- For the Emirates ID number, look for the 15-digit number starting with 784
- Return ONLY valid data, use null for any field you cannot confidently extract

Return your response in this exact JSON format:
{
  "expiryDate": "YYYY-MM-DD or null",
  "emiratesId": "784-YYYY-XXXXXXX-X or null",
  "arabicName": "الاسم العربي or null",
  "englishName": "ENGLISH NAME or null",
  "confidence": "high or medium or low"
}

Do not include any explanations, only return the JSON object.`,

    employment_contract: `You are an expert at extracting information from employment contracts.

Please analyze this employment contract document and extract the following information:

1. **Expiry Date**: The contract end date (if it's a fixed-term contract)
2. **Contract Type**: Whether it's "fixed_term" (has end date) or "unlimited" (no end date)
3. **Start Date**: The contract start date or employment commencement date

IMPORTANT INSTRUCTIONS:
- For dates, use ISO format: YYYY-MM-DD
- Look for terms like "Contract Period", "Duration", "End Date", "Term of Employment"
- If there's no end date mentioned, it's likely an unlimited contract
- Return ONLY valid data, use null for any field you cannot confidently extract

Return your response in this exact JSON format:
{
  "expiryDate": "YYYY-MM-DD or null",
  "contractType": "fixed_term or unlimited or null",
  "startDate": "YYYY-MM-DD or null",
  "confidence": "high or medium or low"
}

Do not include any explanations, only return the JSON object.`,
  };

  return prompts[documentType];
}

/**
 * Extract document information using OpenAI GPT-4 Vision
 */
export async function extractDocumentWithAI(
  imageFile: File | Blob,
  documentType: DocumentType
): Promise<DocumentExtractionResult> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  // Check if API key is configured
  if (!apiKey || apiKey === 'your-openai-api-key-here') {
    console.warn('⚠️ OpenAI API key not configured');
    return createFailedResult(documentType, 'OpenAI API key not configured');
  }

  try {
    console.log(`🤖 Starting AI extraction for ${documentType}...`);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });

    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    const mimeType = imageFile.type || 'image/jpeg';

    // Call GPT-4 Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: getExtractionPrompt(documentType),
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    // Parse AI response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    console.log(`🤖 AI Response for ${documentType}:`, content);

    // Extract JSON from response
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
    }

    // Check if the response looks like an error message instead of JSON
    if (jsonContent.toLowerCase().startsWith("i'm") ||
        jsonContent.toLowerCase().startsWith("i am") ||
        jsonContent.toLowerCase().startsWith("sorry") ||
        jsonContent.toLowerCase().startsWith("unfortunately") ||
        !jsonContent.startsWith('{')) {
      console.warn('AI returned non-JSON response:', jsonContent.substring(0, 100));
      return createFailedResult(documentType, 'AI could not extract data from this document');
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', jsonContent.substring(0, 200));
      return createFailedResult(documentType, 'Invalid response format from AI');
    }

    // Process based on document type
    return processExtractionResult(documentType, extracted);

  } catch (error) {
    console.error(`❌ AI extraction failed for ${documentType}:`, error);
    return createFailedResult(documentType, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Process extraction result based on document type
 */
function processExtractionResult(
  documentType: DocumentType,
  extracted: Record<string, unknown>
): DocumentExtractionResult {
  const confidence = (extracted.confidence as 'high' | 'medium' | 'low') || 'medium';
  const expiryDate = parseDate(extracted.expiryDate as string);

  switch (documentType) {
    case 'passport':
      return {
        documentType: 'passport',
        expiryDate,
        passportNumber: cleanString(extracted.passportNumber as string),
        fullName: cleanString(extracted.fullName as string),
        nationality: cleanString(extracted.nationality as string),
        extractionMethod: 'ai',
        confidence,
      };

    case 'employment_visa':
      return {
        documentType: 'employment_visa',
        expiryDate,
        visaNumber: cleanString(extracted.visaNumber as string),
        visaType: cleanString(extracted.visaType as string),
        extractionMethod: 'ai',
        confidence,
      };

    case 'emirates_id':
      return {
        documentType: 'emirates_id',
        expiryDate,
        emiratesId: formatEmiratesId(extracted.emiratesId as string),
        arabicName: cleanString(extracted.arabicName as string),
        englishName: cleanString(extracted.englishName as string),
        extractionMethod: 'ai',
        confidence,
      };

    case 'employment_contract':
      return {
        documentType: 'employment_contract',
        expiryDate,
        contractType: parseContractType(extracted.contractType as string),
        startDate: parseDate(extracted.startDate as string),
        extractionMethod: 'ai',
        confidence,
      };
  }
}

/**
 * Create a failed result for a document type
 */
function createFailedResult(
  documentType: DocumentType,
  errorMessage: string
): DocumentExtractionResult {
  const baseResult = {
    expiryDate: null,
    extractionMethod: 'failed' as const,
    confidence: 'low' as const,
    error: errorMessage,
  };

  switch (documentType) {
    case 'passport':
      return {
        ...baseResult,
        documentType: 'passport',
        passportNumber: null,
        fullName: null,
        nationality: null,
      };

    case 'employment_visa':
      return {
        ...baseResult,
        documentType: 'employment_visa',
        visaNumber: null,
        visaType: null,
      };

    case 'emirates_id':
      return {
        ...baseResult,
        documentType: 'emirates_id',
        emiratesId: null,
        arabicName: null,
        englishName: null,
      };

    case 'employment_contract':
      return {
        ...baseResult,
        documentType: 'employment_contract',
        contractType: null,
        startDate: null,
      };
  }
}

/**
 * Helper: Clean and validate string
 */
function cleanString(value: string | null | undefined): string | null {
  if (!value || value === 'null' || value === 'undefined') {
    return null;
  }
  return value.trim();
}

/**
 * Helper: Parse date to YYYY-MM-DD format
 */
function parseDate(value: string | null | undefined): string | null {
  if (!value || value === 'null') {
    return null;
  }

  // Try to parse the date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }

  // Return in YYYY-MM-DD format
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Format Emirates ID to standard format
 */
function formatEmiratesId(value: string | null | undefined): string | null {
  if (!value || value === 'null') {
    return null;
  }

  const cleaned = value.replace(/[-\s]/g, '');
  if (cleaned.length === 15 && cleaned.startsWith('784')) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 7)}-${cleaned.substring(7, 14)}-${cleaned.substring(14)}`;
  }

  return null;
}

/**
 * Helper: Parse contract type
 */
function parseContractType(value: string | null | undefined): 'fixed_term' | 'unlimited' | null {
  if (!value || value === 'null') {
    return null;
  }

  const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized === 'fixedterm' || normalized === 'fixed') {
    return 'fixed_term';
  }
  if (normalized === 'unlimited' || normalized === 'permanent' || normalized === 'openended') {
    return 'unlimited';
  }

  return null;
}

/**
 * Check if extraction was successful (has expiry date)
 */
export function isExtractionSuccessful(result: DocumentExtractionResult): boolean {
  return result.expiryDate !== null && result.extractionMethod === 'ai';
}

/**
 * Get extracted data as JSONB for database storage
 */
export function getExtractedDataForStorage(result: DocumentExtractionResult): Record<string, unknown> {
  const { extractionMethod, confidence, error, ...data } = result;
  return {
    ...data,
    extractedAt: new Date().toISOString(),
    extractionMethod,
    confidence,
    ...(error && { error }),
  };
}
