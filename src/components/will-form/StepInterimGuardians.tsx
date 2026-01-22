import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InterimGuardian, Answers, Beneficiary } from "@/types/will-form";
import { useTranslation } from "react-i18next";
import { Trash2, Plus, User, Info, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatPhoneNumber } from "@/utils/phoneValidation";
import { StepTitle } from "./StepTitle";
import { PassportUploadSection } from "./PassportUploadSection";
import { EmiratesIdUpload } from "./EmiratesIdUpload";
import { findExistingPassport, shouldDisablePassportUpload, getPassportDisabledMessage } from "@/lib/passport-utils";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StepInterimGuardiansProps {
  data: InterimGuardian[];
  onChange: (guardians: InterimGuardian[]) => void;
  permissionToContact?: boolean;
  onPermissionChange?: (permission: boolean) => void;
  skipInterimGuardians?: boolean;
  onSkipChange?: (skip: boolean) => void;
  onSkipWithClear?: (skip: boolean) => void;
  errors?: Record<string, string>;
  willId?: string;
  allAnswers?: Answers;
  onFileMetadataUpdate?: (metadata: any) => void;
}

export function StepInterimGuardians({
  data,
  onChange,
  allAnswers,
  permissionToContact = true,
  onPermissionChange,
  skipInterimGuardians = false,
  onSkipChange,
  onSkipWithClear,
  errors = {},
  willId,
  onFileMetadataUpdate,
}: StepInterimGuardiansProps) {
  const { t, i18n } = useTranslation(['form', 'common']);
  const isRtl = i18n.language === 'ar';
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Get beneficiaries from allAnswers
  const beneficiaries: Beneficiary[] = allAnswers?.beneficiaries || [];

  // Local state for optimistic UI updates
  const [localSkip, setLocalSkip] = useState(skipInterimGuardians);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalSkip(skipInterimGuardians);
  }, [skipInterimGuardians]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && !(event.target as Element).closest('.relative')) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Auto-fill passports for interim guardians with matching names
  useEffect(() => {
    if (!allAnswers) return;

    let updated = false;
    const newData = data.map(guardian => {
      if (!guardian.name?.trim() || (guardian.passport_path && guardian.passport_number)) {
        return guardian;
      }

      const existingPassport = findExistingPassport(allAnswers, guardian.name);
      if (existingPassport) {
        updated = true;
        return {
          ...guardian,
          passport_path: existingPassport.passport_path,
          passport_number: existingPassport.passport_number,
        };
      }

      return guardian;
    });

    if (updated) {
      onChange(newData);
    }
  }, [data, allAnswers]);

  const getFieldError = (index: number, field: string) => {
    return (
      errors?.[`${index}.${field}`] ||
      errors?.[`interim_guardians.${index}.${field}`]
    );
  };

  const addGuardianAtLevel = (level: number) => {
    // If skip is checked, uncheck it first
    if (localSkip) {
      setLocalSkip(false);
      if (onSkipChange) {
        onSkipChange(false);
      }
    }

    onChange([
      ...data,
      {
        level,
        name: '',
        relation: '',
        email: '',
        contact_number: '',
      },
    ]);
  };

  const handleAddGuardian = () => {
    // Default to adding at level 1
    addGuardianAtLevel(1);
  };

  const handleRemoveGuardian = (guardian: InterimGuardian) => {
    onChange(data.filter((g) => g !== guardian));
  };

  const handleGuardianChange = (guardian: InterimGuardian, field: keyof InterimGuardian, value: string) => {
    onChange(
      data.map((g) =>
        g === guardian ? { ...g, [field]: value } : g
      )
    );
  };

  const updateGuardianPassportData = (guardian: InterimGuardian, passportData: { path?: string; number?: string }) => {
    // Update both fields at once to avoid race conditions
    const updated = data.map((g) => g === guardian ? {
      ...g,
      passport_path: passportData.path,
      passport_number: passportData.number || '',
    } : g);

    onChange(updated);
  };

  const updateGuardianEmiratesIdData = (guardian: InterimGuardian, emiratesIdData: { path?: string; number?: string }) => {
    const updated = data.map((g) => g === guardian ? {
      ...g,
      emirates_id_path: emiratesIdData.path,
      emirates_id_number: emiratesIdData.number || '',
    } : g);

    onChange(updated);
  };

  const handleBeneficiarySelection = (guardian: InterimGuardian, beneficiary: Beneficiary) => {
    // Auto-fill guardian fields with beneficiary data
    const updated = data.map((g) =>
      g === guardian
        ? {
            ...g,
            name: beneficiary.name,
            relation: beneficiary.relationship,
            email: beneficiary.email || '',
            contact_number: beneficiary.contact_number,
            passport_path: beneficiary.passport_path,
            passport_number: beneficiary.passport_number,
            // Auto-fill Emirates ID from beneficiary
            emirates_id_path: beneficiary.emirates_id_path,
            emirates_id_number: beneficiary.emirates_id_number,
          }
        : g
    );
    onChange(updated);
    setOpenDropdownId(null);
  };

  const guardianData = data || [];
  const sortedGuardians = [...guardianData].sort((a, b) => a.level - b.level);

  // Check which levels exist
  const hasLevel = (level: number) => data.some((g) => g.level === level);

  // Group guardians by level
  const guardiansByLevel = sortedGuardians.reduce((acc, guardian) => {
    if (!acc[guardian.level]) acc[guardian.level] = [];
    acc[guardian.level].push(guardian);
    return acc;
  }, {} as Record<number, InterimGuardian[]>);

  const getLevelLabel = (level: number) => {
    if (level === 1) return t('form:primaryGuardianLabel');
    if (level === 2) return t('form:backup1GuardianLabel');
    return t('form:backup2GuardianLabel');
  };

  return (
    <div className="space-y-8 relative">
      {/* Intro Section */}
      <div className="space-y-3 pb-6 border-b border-[rgba(198,160,59,0.3)]">
        <StepTitle title={t('interimTemporaryGuardiansTitle')} />
        <div className="space-y-4">
          <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
            {t('form:interimGuardiansIntro')}
          </p>
          <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
            {t('form:interimGuardiansDescription')}
          </p>
        </div>
      </div>

      {/* Skip Checkbox Card */}
      <Card className="bg-[#F8F8F6] border-[#E6E6E4]">
        <CardContent className="pt-5 pb-5 px-5">
          <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
            <Checkbox
              id="skip_interim_guardians"
              checked={localSkip}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;

                // Update local state
                setLocalSkip(isChecked);

                if (isChecked) {
                  // Use the combined callback to update both skip and interim guardians in one state update
                  if (onSkipWithClear) {
                    onSkipWithClear(true);
                  } else {
                    // Fallback to separate calls if combined callback not available
                    onChange([]);
                    if (onSkipChange) {
                      onSkipChange(true);
                    }
                  }
                } else {
                  // Unchecking skip
                  if (onSkipChange) {
                    onSkipChange(false);
                  }
                }
              }}
            />
            <div className="flex-1">
              <Label
                htmlFor="skip_interim_guardians"
                className="text-sm font-medium cursor-pointer leading-relaxed flex items-center gap-2"
              >
                {t('form:skipInterimGuardianCheckbox')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div onClick={(e) => e.preventDefault()}>
                        <Info className="h-3.5 w-3.5 text-[#888] hover:text-[#0C5536] transition-colors duration-200" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#0C5536] text-white border-[#0C5536]">
                      <p className="text-xs">
                        {t('form:skipInterimGuardianTooltip')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
          </div>

          {/* Validation Error Message - Below checkbox - Only show when skip is NOT checked */}
          {!localSkip && !skipInterimGuardians && data.length === 0 && errors && Object.keys(errors).length > 0 && (
            <div className="mt-3 bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                {Object.values(errors)[0] || t('form:interimGuardianRequiredError')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conditional rendering: Only show form if NOT skipping */}
      {!localSkip && (
        <>
          {/* Guardian List */}
          <div className="space-y-6">
            {/* Render guardians grouped by level */}
            {[1, 2, 3].map((level) => {
          const levelGuardians = guardiansByLevel[level] || [];
          if (levelGuardians.length === 0) return null;

          return (
            <div key={level} className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 bg-[#0C5536] text-white px-3 py-1.5 rounded-md">
                  <User className="w-3.5 h-3.5" />
                  <span className="text-[13px] font-medium">
                    {t("form:levelLabel")} {level}
                  </span>
                </div>
                <span className="text-sm text-[#6B6B6B]">
                  ({getLevelLabel(level)})
                </span>
              </div>

              {levelGuardians.map((guardian, idx) => {
                const globalIndex = sortedGuardians.indexOf(guardian);
                return (
                  <Card
                    key={idx}
                    className="shadow-[0_2px_8px_rgba(12,85,54,0.05)] border border-[#E6E6E4] bg-white"
                  >
                    <CardContent className="pt-8 pb-8 px-10 space-y-6">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-medium">
                          {t('form:guardianLabel')} {idx + 1}
                        </h3>

                        {/* Remove Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveGuardian(guardian)}
                          className="text-[#A12E2E] hover:text-[#A12E2E] hover:bg-[rgba(161,46,46,0.05)] -mr-2"
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          <span className="text-sm">{t("common:remove")}</span>
                        </Button>
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="relative">
                          <Label htmlFor={`interim_guardian_name_${level}_${idx}`}>
                            {t('form:nameLabelRequired')}
                          </Label>
                          <div className="relative">
                            <Input
                              id={`interim_guardian_name_${level}_${idx}`}
                              value={guardian.name}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                handleGuardianChange(guardian, 'name', value);
                              }}
                              onFocus={() => setOpenDropdownId(`interim_guardian_${globalIndex}`)}
                              placeholder={t('form:fullNamePlaceholder2')}
                              className={cn(
                                getFieldError(globalIndex, 'name') ? 'border-destructive' : '',
                                beneficiaries.length > 0 && "pr-10"
                              )}
                            />
                            {beneficiaries.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpenDropdownId(openDropdownId === `interim_guardian_${globalIndex}` ? null : `interim_guardian_${globalIndex}`)}
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              >
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                          {/* Beneficiaries Dropdown */}
                          {openDropdownId === `interim_guardian_${globalIndex}` && beneficiaries.length > 0 && (() => {
                            // Get names already used in this step (excluding current guardian)
                            const usedNames = data
                              .filter(g => g !== guardian && g.name.trim())
                              .map(g => g.name.toLowerCase().trim());

                            // Filter beneficiaries based on current input and exclude already used
                            const searchTerm = guardian.name.toLowerCase().trim();
                            const filteredBeneficiaries = beneficiaries.filter(b =>
                              b.name.toLowerCase().includes(searchTerm) &&
                              !usedNames.includes(b.name.toLowerCase().trim())
                            );

                            if (filteredBeneficiaries.length === 0) return null;

                            return (
                              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                <div className="p-2 text-xs text-muted-foreground border-b">
                                  {t("form:selectFromBeneficiaries")}
                                </div>
                                {filteredBeneficiaries.map((beneficiary, bIdx) => (
                                  <button
                                    key={bIdx}
                                    type="button"
                                    onClick={() => handleBeneficiarySelection(guardian, beneficiary)}
                                    className="w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted"
                                  >
                                    <div className="font-medium">{beneficiary.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {beneficiary.relationship} • {beneficiary.contact_number}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          {getFieldError(globalIndex, 'name') && (
                            <p className="text-sm text-destructive mt-1">{getFieldError(globalIndex, 'name')}</p>
                          )}
                        </div>

                        {/* Relation */}
                        <div>
                          <Label htmlFor={`interim_guardian_relation_${level}_${idx}`}>
                            {t('form:relationLabelRequired')}
                          </Label>
                          <Input
                            id={`interim_guardian_relation_${level}_${idx}`}
                            value={guardian.relation}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                              handleGuardianChange(guardian, 'relation', value);
                            }}
                            placeholder={t('form:relationGuardianPlaceholder')}
                            className={getFieldError(globalIndex, 'relation') ? 'border-destructive' : ''}
                          />
                          {getFieldError(globalIndex, 'relation') && (
                            <p className="text-sm text-destructive mt-1">{getFieldError(globalIndex, 'relation')}</p>
                          )}
                        </div>

                        {/* Email ID */}
                        <div>
                          <Label htmlFor={`interim_guardian_email_${level}_${idx}`}>
                            {t('form:emailIdLabelRequired')}
                          </Label>
                          <Input
                            id={`interim_guardian_email_${level}_${idx}`}
                            type="email"
                            value={guardian.email}
                            onChange={(e) => handleGuardianChange(guardian, 'email', e.target.value)}
                            placeholder={t('form:emailPlaceholder2')}
                            className={getFieldError(globalIndex, 'email') ? 'border-destructive' : ''}
                          />
                          {getFieldError(globalIndex, 'email') && (
                            <p className="text-sm text-destructive mt-1">{getFieldError(globalIndex, 'email')}</p>
                          )}
                        </div>

                        {/* Contact Number */}
                        <div>
                          <Label htmlFor={`interim_guardian_contact_${level}_${idx}`}>
                            {t('form:contactNumberLabelRequired')}
                          </Label>
                          <Input
                            id={`interim_guardian_contact_${level}_${idx}`}
                            type="tel"
                            value={guardian.contact_number}
                            onChange={(e) => handleGuardianChange(guardian, 'contact_number', formatPhoneNumber(e.target.value))}
                            placeholder="+971501234567"
                            className={getFieldError(globalIndex, 'contact_number') ? 'border-destructive' : ''}
                          />
                          {getFieldError(globalIndex, 'contact_number') && (
                            <p className="text-sm text-destructive mt-1">{getFieldError(globalIndex, 'contact_number')}</p>
                          )}
                        </div>

                        {/* Interim Guardian Passport Upload */}
                        {willId && (
                          <div className="md:col-span-2">
                            <PassportUploadSection
                              passportPath={guardian.passport_path}
                              passportNumber={guardian.passport_number || ''}
                              onPassportPathChange={(path) => handleGuardianChange(guardian, 'passport_path', path)}
                              onPassportNumberChange={(number) => handleGuardianChange(guardian, 'passport_number', number)}
                              onPassportDataChange={(data) => updateGuardianPassportData(guardian, data)}
                              onFileMetadataUpdate={onFileMetadataUpdate}
                              willId={willId}
                              uploadPath={`interim-guardian-${level}-${idx}`}
                              stepName="Step 7: Interim Guardians"
                              personName={guardian.name || ''}
                              personRole={`interim-guardian-${level}-${idx}`}
                              label={t('form:passportLabel')}
                              error={getFieldError(globalIndex, 'passport_number')}
                              passportError={getFieldError(globalIndex, 'passport_path')}
                              disabled={shouldDisablePassportUpload(allAnswers, guardian.name || '')}
                              disabledMessage={getPassportDisabledMessage(allAnswers, guardian.name || '')}
                            />
                          </div>
                        )}

                        {/* Emirates ID Upload */}
                        {willId && (
                          <div className="md:col-span-2">
                            <EmiratesIdUpload
                              emiratesIdPath={guardian.emirates_id_path}
                              emiratesIdNumber={guardian.emirates_id_number}
                              onEmiratesIdPathChange={(path) => handleGuardianChange(guardian, 'emirates_id_path', path)}
                              onEmiratesIdNumberChange={(number) => handleGuardianChange(guardian, 'emirates_id_number', number)}
                              onEmiratesIdDataChange={(data) => updateGuardianEmiratesIdData(guardian, data)}
                              onFileMetadataUpdate={onFileMetadataUpdate}
                              willId={willId}
                              uploadPath={`interim-guardian-${level}-${idx}`}
                              stepName="Step 7: Interim Guardians"
                              personName={guardian.name || ''}
                              personRole={`interim-guardian-${level}-${idx}`}
                              label={t('form:emiratesIdLabel')}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Another at this Level Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => addGuardianAtLevel(level)}
                className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('form:addAnotherAtLevel', { level })}
              </Button>
            </div>
          );
        })}

        {/* Add Next Level Buttons */}
        {hasLevel(1) && !hasLevel(2) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addGuardianAtLevel(2)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('form:addLevel2')} ({t('form:backup1GuardianLabel')})
          </Button>
        )}

        {hasLevel(2) && !hasLevel(3) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addGuardianAtLevel(3)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('form:addLevel3')} ({t('form:backup2GuardianLabel')})
          </Button>
        )}

        {/* Empty State */}

        {guardianData.length === 0 && (
          <Card className="border-dashed border-[#E6E6E4] bg-white">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-sm text-[#6B6B6B]">{t('form:noInterimGuardiansYet')}</p>
              <Button
                type="button"
                onClick={handleAddGuardian}
                className="bg-[#0C5536] text-white hover:bg-[#134A35] hover:shadow-[0_0_6px_rgba(198,160,59,0.35)] transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('form:addFirstInterimGuardian')}
              </Button>
            </CardContent>
          </Card>
        )}
          </div>

          {/* Permission Checkbox */}
          {guardianData.length > 0 && (
            <Card className="bg-[#F8F8F6] border-[#E6E6E4]">
              <CardContent className="pt-5 pb-5 px-5">
                <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
                  <Checkbox
                    id="interim_guardian_permission"
                    checked={permissionToContact}
                    onCheckedChange={(checked) => onPermissionChange?.(checked === true)}
                    className="mt-1.5 rounded-sm"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="interim_guardian_permission"
                      className="cursor-pointer leading-relaxed"
                    >
                      {t('form:permissionToContactInterimGuardians')}
                    </Label>
                    <p className="text-xs text-[#6B6B6B] italic">
                      {t('form:guardianContactNotice')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Show message when skipping */}
      {localSkip && (
        <Card className="border-dashed border-[#E6E6E4] bg-white">
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-sm text-[#6B6B6B]">
              {t('form:skipInterimGuardianConfirmation')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
