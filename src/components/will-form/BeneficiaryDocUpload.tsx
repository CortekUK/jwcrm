import { useEffect } from 'react';
import { PassportUploadSection } from './PassportUploadSection';
import { findExistingPassport, shouldDisablePassportUpload, getPassportDisabledMessage } from '@/lib/passport-utils';
import type { Answers } from '@/types/will-form';

interface BeneficiaryDocUploadProps {
  beneficiaryIndex: number;
  documents: any[]; // Keep for backwards compatibility but not used
  onChange: (docs: any[]) => void; // Keep for backwards compatibility but not used
  willId: string;
  disabled?: boolean;
  passportPath?: string;
  passportNumber?: string;
  personName?: string; // Name of the person for duplicate detection
  allAnswers?: Answers; // All form answers for passport lookup
  onPassportPathChange?: (path: string | undefined) => void;
  onPassportNumberChange?: (number: string) => void;
  onPassportDataChange?: (data: { path?: string; number?: string }) => void;
  onFileMetadataUpdate?: (metadata: any) => void;
  stepName?: string;
  personRole?: string;
  error?: string; // Validation error message
}

export function BeneficiaryDocUpload({
  beneficiaryIndex,
  willId,
  passportPath,
  passportNumber,
  personName,
  allAnswers,
  onPassportPathChange,
  onPassportNumberChange,
  onPassportDataChange,
  onFileMetadataUpdate,
  stepName,
  personRole,
  error,
}: BeneficiaryDocUploadProps) {
  // Auto-fill passport from existing data when name matches
  useEffect(() => {
    if (!allAnswers || !personName?.trim()) return;

    // Skip if passport already set for this person
    if (passportPath && passportNumber) return;

    // Look for existing passport with this name
    const existingPassport = findExistingPassport(allAnswers, personName);
    if (existingPassport && onPassportDataChange) {
      onPassportDataChange({
        path: existingPassport.passport_path,
        number: existingPassport.passport_number,
      });
    }
  }, [personName, allAnswers, passportPath, passportNumber, onPassportDataChange]);

  // Only show passport upload section
  if (!onPassportPathChange || !onPassportNumberChange) {
    return null;
  }

  // Check if upload should be disabled
  const isDisabled = shouldDisablePassportUpload(allAnswers, personName || '');
  const disabledMessage = getPassportDisabledMessage(allAnswers, personName || '');

  return (
    <div>
      <PassportUploadSection
        passportPath={passportPath}
        passportNumber={passportNumber || ''}
        onPassportPathChange={onPassportPathChange}
        onPassportNumberChange={onPassportNumberChange}
        onPassportDataChange={onPassportDataChange}
        onFileMetadataUpdate={onFileMetadataUpdate}
        willId={willId}
        uploadPath={`beneficiary-${beneficiaryIndex}`}
        stepName={stepName || 'Step 10: Beneficiaries'}
        personName={personName}
        personRole={personRole || `beneficiary-${beneficiaryIndex}`}
        label="Passport"
        error={error}
        disabled={isDisabled}
        disabledMessage={disabledMessage}
      />
    </div>
  );
}
