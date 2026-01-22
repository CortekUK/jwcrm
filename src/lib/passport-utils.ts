import type { Answers } from '@/types/will-form';

/**
 * Find existing passport data for a person by their name (case-insensitive)
 * Searches across all form steps (beneficiaries, executors, trustees, guardians, etc.)
 */
export function findExistingPassport(
  answers: Answers,
  name: string
): { passport_number: string; passport_path: string } | undefined {
  if (!name?.trim()) return undefined;

  const normalizedName = name.trim().toLowerCase();

  // Search all person arrays
  const allPeople = [
    ...(answers.beneficiaries || []),
    ...(answers.executors || []),
    ...(answers.trustees || []),
    ...(answers.interim_guardians || []),
    ...(answers.permanent_guardians || []),
    ...(answers.receipt_of_will || []),
    ...(answers.disinherit || []),
  ];

  // Find first person with matching name who has passport
  for (const person of allPeople) {
    if (
      person.name?.trim().toLowerCase() === normalizedName &&
      person.passport_number &&
      person.passport_path
    ) {
      return {
        passport_number: person.passport_number,
        passport_path: person.passport_path,
      };
    }
  }

  return undefined;
}

/**
 * Check if passport upload should be disabled
 * Disabled if: no name OR passport already exists for this person
 */
export function shouldDisablePassportUpload(
  answers: Answers | undefined,
  name: string
): boolean {
  // Disable if no name entered yet
  if (!name?.trim()) return true;

  // Disable if no answers available
  if (!answers) return true;

  // Check if passport already exists for this name
  const existingPassport = findExistingPassport(answers, name);
  return existingPassport !== undefined;
}

/**
 * Get disabled message explaining why passport upload is disabled
 */
export function getPassportDisabledMessage(
  answers: Answers | undefined,
  name: string
): string | undefined {
  if (!name?.trim()) {
    return "Please enter name first";
  }

  if (!answers) return undefined;

  const existingPassport = findExistingPassport(answers, name);
  if (existingPassport) {
    return `Passport already uploaded (${existingPassport.passport_number})`;
  }

  return undefined;
}
