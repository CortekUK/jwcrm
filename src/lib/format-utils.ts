type Locale = 'en' | 'ar';

export const formatDate = (
  date: string | Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', defaultOptions).format(
    new Date(date)
  );
};

export const formatDateTime = (
  date: string | Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', defaultOptions).format(
    new Date(date)
  );
};

export const formatNumber = (
  number: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string => {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', options).format(number);
};

export const formatCurrency = (
  amount: number,
  locale: Locale,
  currency: string = 'USD'
): string => {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatPercentage = (
  value: number,
  locale: Locale,
  decimals: number = 0
): string => {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

// Arabic-Indic numerals mapping (٠١٢٣٤٥٦٧٨٩)
const arabicIndicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Convert Western numerals (0-9) to Arabic-Indic numerals (٠-٩)
 * @param input - String or number containing Western numerals
 * @returns String with Arabic-Indic numerals
 */
export const toArabicNumerals = (input: string | number): string => {
  return String(input).replace(/[0-9]/g, (digit) => arabicIndicNumerals[parseInt(digit)]);
};

/**
 * Convert Arabic-Indic numerals (٠-٩) to Western numerals (0-9)
 * @param input - String containing Arabic-Indic numerals
 * @returns String with Western numerals
 */
export const toWesternNumerals = (input: string): string => {
  return input.replace(/[٠-٩]/g, (digit) => String(arabicIndicNumerals.indexOf(digit)));
};

/**
 * Format invoice number for display based on locale
 * @param invoiceNumber - Invoice number (e.g., "INV-2026-00001")
 * @param locale - Target locale
 * @returns Formatted invoice number
 */
export const formatInvoiceNumber = (invoiceNumber: string, locale: Locale): string => {
  if (locale === 'ar') {
    return toArabicNumerals(invoiceNumber);
  }
  return invoiceNumber;
};

/**
 * Format currency amount with proper Arabic/English display
 * Includes currency symbol placement based on locale
 * @param amount - Amount in decimal
 * @param locale - Target locale
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export const formatCurrencyDisplay = (
  amount: number,
  locale: Locale,
  currency: string = 'USD'
): string => {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return formatted;
};

/**
 * Format a date for invoice/proposal display
 * @param date - Date to format
 * @param locale - Target locale
 * @returns Formatted date string
 */
export const formatDocumentDate = (
  date: Date | string,
  locale: Locale
): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
};
