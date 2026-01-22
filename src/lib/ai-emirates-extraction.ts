/**
 * AI-Based Emirates ID Extraction using OpenAI GPT-4 Vision
 *
 * This module provides intelligent extraction of:
 * - Emirates ID Number
 * - Arabic Name (الاسم)
 * - English Name
 *
 * Falls back to traditional OCR if AI extraction fails
 */

import OpenAI from 'openai';
import { extractEmiratesIdFromText, extractNameFromEmiratesIdText } from './emirates-id-utils';

interface EmiratesIdExtractionResult {
  emiratesId: string | null;
  arabicName: string | null;
  englishName: string | null;
  extractionMethod: 'ai' | 'ocr-fallback' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

/**
 * Convert File or Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix if present
      const base64Data = base64String.split(',')[1] || base64String;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extract Emirates ID information using OpenAI GPT-4 Vision
 */
export async function extractEmiratesIdWithAI(
  imageFile: File | Blob
): Promise<EmiratesIdExtractionResult> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  // Check if API key is configured
  if (!apiKey || apiKey === 'your-openai-api-key-here') {
    console.warn('⚠️ OpenAI API key not configured, falling back to OCR extraction');
    return fallbackToOCR(imageFile);
  }

  try {
    console.log('🤖 Starting AI-based Emirates ID extraction...');

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });

    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    const mimeType = imageFile.type || 'image/jpeg';

    // Call GPT-4 Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert at extracting information from UAE Emirates ID cards.

Please analyze this Emirates ID card image and extract the following information:

1. **Emirates ID Number**: Format is 784-YYYY-XXXXXXX-X (15 digits total, starts with 784)
2. **Arabic Name**: The full name in Arabic script (الاسم)
3. **English Name**: The full name in English/Latin script

IMPORTANT INSTRUCTIONS:
- The Emirates ID has BOTH Arabic and English names printed on it
- Extract BOTH the Arabic name (in Arabic script: ء-ي characters) and English name
- For the Emirates ID number, look for the 15-digit number starting with 784
- Return ONLY valid data, use null for any field you cannot confidently extract
- The Arabic name is usually printed above or next to the English name

Return your response in this exact JSON format:
{
  "emiratesId": "784-YYYY-XXXXXXX-X or null",
  "arabicName": "الاسم العربي or null",
  "englishName": "ENGLISH NAME or null",
  "confidence": "high or medium or low"
}

Do not include any explanations, only return the JSON object.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high', // Use high detail for better accuracy
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1, // Low temperature for consistent extraction
    });

    // Parse AI response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('🤖 AI Response:', content);

    // Extract JSON from response (handle markdown code blocks)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
    }

    const extracted = JSON.parse(jsonContent);

    // Validate and format Emirates ID
    let formattedEmiratesId = null;
    if (extracted.emiratesId) {
      const cleaned = extracted.emiratesId.replace(/[-\s]/g, '');
      if (cleaned.length === 15 && cleaned.startsWith('784')) {
        formattedEmiratesId = `${cleaned.substring(0, 3)}-${cleaned.substring(3, 7)}-${cleaned.substring(7, 14)}-${cleaned.substring(14)}`;
      }
    }

    // Clean up names
    const arabicName = extracted.arabicName && extracted.arabicName !== 'null'
      ? extracted.arabicName.trim()
      : null;

    const englishName = extracted.englishName && extracted.englishName !== 'null'
      ? extracted.englishName.trim()
      : null;

    const confidence = extracted.confidence || 'medium';

    console.log('✅ AI Extraction successful:', {
      emiratesId: formattedEmiratesId,
      arabicName,
      englishName,
      confidence,
    });

    return {
      emiratesId: formattedEmiratesId,
      arabicName,
      englishName,
      extractionMethod: 'ai',
      confidence,
    };

  } catch (error) {
    console.error('❌ AI extraction failed:', error);

    // Fall back to traditional OCR
    console.log('📝 Falling back to traditional OCR extraction...');
    return fallbackToOCR(imageFile);
  }
}

/**
 * Fallback to traditional OCR-based extraction
 */
async function fallbackToOCR(imageFile: File | Blob): Promise<EmiratesIdExtractionResult> {
  try {
    console.log('📝 Running OCR fallback extraction...');

    // Dynamically import Tesseract only when needed
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');

    // Perform OCR
    const { data: { text } } = await worker.recognize(imageFile);
    await worker.terminate();

    console.log('OCR text extracted:', text);

    const emiratesId = extractEmiratesIdFromText(text);
    const name = extractNameFromEmiratesIdText(text);

    // Determine if extracted name is Arabic or English
    let arabicName: string | null = null;
    let englishName: string | null = null;

    if (name) {
      // Check if name contains Arabic characters
      if (/[\u0600-\u06FF]/.test(name)) {
        arabicName = name;
      } else {
        englishName = name;
      }
    }

    return {
      emiratesId,
      arabicName,
      englishName,
      extractionMethod: 'ocr-fallback',
      confidence: emiratesId ? 'medium' : 'low',
    };
  } catch (error) {
    console.error('OCR fallback failed:', error);
    return {
      emiratesId: null,
      arabicName: null,
      englishName: null,
      extractionMethod: 'failed',
      confidence: 'low',
      error: 'Both AI and OCR extraction failed',
    };
  }
}

/**
 * Get display name based on locale preference
 * @param result - The extraction result
 * @param preferredLocale - User's preferred locale ('ar' for Arabic, 'en' for English)
 * @returns The name in the preferred language, or fallback to available name
 */
export function getDisplayName(
  result: EmiratesIdExtractionResult,
  preferredLocale?: 'ar' | 'en'
): string | null {
  // If locale preference specified, respect it with proper fallback
  if (preferredLocale === 'ar') {
    // Prefer Arabic, fallback to English if Arabic not available
    return result.arabicName || result.englishName;
  }

  if (preferredLocale === 'en') {
    // Prefer English, fallback to Arabic if English not available
    return result.englishName || result.arabicName;
  }

  // No preference specified: return whichever is available (Arabic first for compatibility)
  return result.arabicName || result.englishName;
}

/**
 * Check if extraction was successful
 */
export function isExtractionSuccessful(result: EmiratesIdExtractionResult): boolean {
  return result.emiratesId !== null && (result.arabicName !== null || result.englishName !== null);
}
