/**
 * Translation Service
 * Translates text content from English to Arabic
 */

export interface TranslationOptions {
  from?: string;
  to: string;
}

/**
 * Translate text using LibreTranslate API (open source, free)
 * Can be replaced with Google Translate, DeepL, or Azure Translator
 */
export async function translateText(
  text: string | null | undefined,
  options: TranslationOptions = { from: 'en', to: 'ar' }
): Promise<string> {
  if (!text || text.trim() === '') return '';

  try {
    // Using LibreTranslate (free, open source)
    // You can replace this with Google Translate API or Azure Translator
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: options.from || 'en',
        target: options.to,
        format: 'text'
      })
    });

    if (!response.ok) {
      console.error('Translation API error:', response.statusText);
      return text; // Return original text if translation fails
    }

    const data = await response.json();
    return data.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
}

/**
 * Translate multiple texts at once (batch translation)
 */
export async function translateBatch(
  texts: string[],
  options: TranslationOptions = { from: 'en', to: 'ar' }
): Promise<string[]> {
  const promises = texts.map(text => translateText(text, options));
  return Promise.all(promises);
}

/**
 * Translate answers object fields that contain user-entered text
 * Does NOT translate names, emails, phone numbers, or addresses
 */
export async function translateWillAnswers(answers: any, targetLocale: string): Promise<any> {
  if (!answers || targetLocale === 'en') return answers;

  const translated = { ...answers };

  try {
    // Translate asset descriptions
    if (translated.assets && Array.isArray(translated.assets)) {
      translated.assets = await Promise.all(
        translated.assets.map(async (asset: any) => ({
          ...asset,
          description: await translateText(asset.description, { to: targetLocale }),
          // Keep category, location, value as-is (these are enums or numbers)
        }))
      );
    }

    // Translate beneficiary comments
    if (translated.beneficiaries && Array.isArray(translated.beneficiaries)) {
      translated.beneficiaries = await Promise.all(
        translated.beneficiaries.map(async (beneficiary: any) => ({
          ...beneficiary,
          comments: await translateText(beneficiary.comments, { to: targetLocale }),
          // Keep name, relationship, percentage as-is
        }))
      );
    }

    // Translate special requests
    if (translated.special_requests) {
      const requests = translated.special_requests;
      translated.special_requests = {
        ...requests,
        funeral_wishes: await translateText(requests.funeral_wishes, { to: targetLocale }),
        guardianship: await translateText(requests.guardianship, { to: targetLocale }),
        digital_assets: await translateText(requests.digital_assets, { to: targetLocale }),
        other: await translateText(requests.other, { to: targetLocale }),
      };
    }

    // Translate family exclusion letter
    if (translated.family_exclusion) {
      const exclusion = translated.family_exclusion;
      translated.family_exclusion = {
        ...exclusion,
        letter_to_loved_ones: await translateText(exclusion.letter_to_loved_ones, { to: targetLocale }),
      };
    }

  } catch (error) {
    console.error('Error translating answers:', error);
    return answers; // Return original on error
  }

  return translated;
}
