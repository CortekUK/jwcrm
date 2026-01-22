/**
 * Format and validate phone numbers
 * Only allows digits and + at the start
 * Does NOT auto-format - shows validation errors instead
 */

export function formatPhoneNumber(value: string): string {
  // Only allow digits and + at the beginning
  // Remove any characters that aren't digits or +
  let cleaned = value.replace(/[^\d+]/g, '');

  // Ensure + only appears at the start
  if (cleaned.includes('+')) {
    const firstPlus = cleaned.indexOf('+');
    const restWithoutPlus = cleaned.slice(firstPlus + 1).replace(/\+/g, '');
    cleaned = cleaned[0] === '+' ? '+' + restWithoutPlus : restWithoutPlus;
  }

  return cleaned;
}

export function isValidPhoneNumber(value: string): boolean {
  if (!value) return false;

  // Extract only digits
  const digitsOnly = value.replace(/\D/g, '');

  // Must have between 7 and 15 digits
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export function getPhoneNumberError(value: string): string | null {
  if (!value) return "Phone number is required";

  const digitsOnly = value.replace(/\D/g, '');

  if (digitsOnly.length < 7) {
    return "Phone number must be at least 7 digits";
  }

  if (digitsOnly.length > 15) {
    return "Phone number must not exceed 15 digits";
  }

  return null;
}

/**
 * Handle phone input onChange event
 * Returns formatted phone number
 */
export function handlePhoneInput(e: React.ChangeEvent<HTMLInputElement>): string {
  return formatPhoneNumber(e.target.value);
}
