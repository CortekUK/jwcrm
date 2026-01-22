import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trustee, Answers, Beneficiary } from "@/types/will-form";
import { useTranslation } from "react-i18next";
import { Trash2, Plus, User, Info, ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatPhoneNumber } from "@/utils/phoneValidation";
import { StepTitle } from "./StepTitle";
import { PassportUploadSection } from "./PassportUploadSection";
import { EmiratesIdUpload } from "./EmiratesIdUpload";
import { findExistingPassport, shouldDisablePassportUpload, getPassportDisabledMessage } from "@/lib/passport-utils";
import { cn } from "@/lib/utils";

interface StepTrusteesProps {
  data: Trustee[];
  onChange: (trustees: Trustee[]) => void;
  permissionToContact?: boolean;
  onPermissionChange?: (permission: boolean) => void;
  skipTrustees?: boolean;
  onSkipChange?: (skip: boolean) => void;
  onSkipWithClear?: (skip: boolean) => void;
  errors?: Record<string, string>;
  willId?: string;
  allAnswers?: Answers;
  onFileMetadataUpdate?: (metadata: any) => void;
}

export function StepTrustees({
  data,
  onChange,
  allAnswers,
  permissionToContact = true,
  onPermissionChange,
  skipTrustees = false,
  onSkipChange,
  onSkipWithClear,
  errors = {},
  willId,
  onFileMetadataUpdate,
}: StepTrusteesProps) {
  const { t, i18n } = useTranslation(["form", "common"]);
  const isRtl = i18n.language === 'ar';

  // Local state for optimistic UI updates
  const [localSkip, setLocalSkip] = useState(skipTrustees);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Get beneficiaries from allAnswers
  const beneficiaries: Beneficiary[] = allAnswers?.beneficiaries || [];

  // Sync local state with prop changes
  useEffect(() => {
    setLocalSkip(skipTrustees);
  }, [skipTrustees]);

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

  // Auto-fill passports for trustees with matching names
  useEffect(() => {
    if (!allAnswers) return;

    let updated = false;
    const newData = data.map(trustee => {
      if (!trustee.name?.trim() || (trustee.passport_path && trustee.passport_number)) {
        return trustee;
      }

      const existingPassport = findExistingPassport(allAnswers, trustee.name);
      if (existingPassport) {
        updated = true;
        return {
          ...trustee,
          passport_path: existingPassport.passport_path,
          passport_number: existingPassport.passport_number,
        };
      }

      return trustee;
    });

    if (updated) {
      onChange(newData);
    }
  }, [data, allAnswers]);

  const handleAddTrusteeAtLevel = (level: number) => {
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
        name: "",
        relation: "",
        email: "",
        contact_number: "",
      },
    ]);
  };

  const handleAddTrustee = () => {
    // Default to adding at level 1
    handleAddTrusteeAtLevel(1);
  };

  const handleRemoveTrustee = (trustee: Trustee) => {
    onChange(data.filter((t) => t !== trustee));
  };

  const handleTrusteeChange = (
    trustee: Trustee,
    field: keyof Trustee,
    value: string
  ) => {
    onChange(
      data.map((t) => (t === trustee ? { ...t, [field]: value } : t))
    );
  };

  const updateTrusteePassportData = (trustee: Trustee, passportData: { path?: string; number?: string }) => {
    // Update both fields at once to avoid race conditions
    const updated = data.map((t) => t === trustee ? {
      ...t,
      passport_path: passportData.path,
      passport_number: passportData.number || '',
    } : t);

    onChange(updated);
  };

  const updateTrusteeEmiratesIdData = (trustee: Trustee, emiratesIdData: { path?: string; number?: string }) => {
    // Update both fields at once to avoid race conditions
    const updated = data.map((t) => t === trustee ? {
      ...t,
      emirates_id_path: emiratesIdData.path,
      emirates_id_number: emiratesIdData.number || '',
    } : t);

    onChange(updated);
  };

  const handleBeneficiarySelection = (trustee: Trustee, beneficiary: Beneficiary) => {
    // Auto-fill trustee fields with beneficiary data
    const updated = data.map((t) =>
      t === trustee
        ? {
            ...t,
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
        : t
    );
    onChange(updated);
    setOpenDropdownId(null);
  };

  const sortedTrustees = [...data].sort((a, b) => a.level - b.level);
  const canAddMore = data.length < 3;

  const getLevelLabel = (level: number) => {
    if (level === 1) return "(Primary)";
    if (level === 2) return "(Contingent)";
    return "(Contingent)";
  };

  // Check which levels exist
  const hasLevel = (level: number) => data.some((t) => t.level === level);

  // Group trustees by level
  const trusteesByLevel = sortedTrustees.reduce((acc, trustee) => {
    if (!acc[trustee.level]) acc[trustee.level] = [];
    acc[trustee.level].push(trustee);
    return acc;
  }, {} as Record<number, Trustee[]>);

  return (
    <div className="space-y-8 relative">
      {/* Intro Section */}
      <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.4)]">
        <StepTitle title={t("trustees")} />

        <div className="space-y-3">
          <p className="text-[15px] font-bold text-[#333]">
            {t('form:trusteesSubtitle')}
          </p>
          <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
            {t('form:trusteesDescription')}
          </p>
          <p className="text-[14px] text-[#6B6B6B] leading-[1.7] mt-4">
            {t('form:trusteesOptionalNote')}
          </p>
        </div>
      </div>

      {/* Skip Trustees Checkbox */}
      <Card className="bg-[#F8F8F6] border border-[#E6E6E4] rounded-md">
        <CardContent className="pt-4 pb-4 px-4">
          <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
            <Checkbox
              id="skip_trustees"
              checked={localSkip}
              className="rounded-sm mt-0.5"
              onCheckedChange={(checked) => {
                const isChecked = checked === true;

                // Update local state
                setLocalSkip(isChecked);

                if (isChecked) {
                  // Use the combined callback to update both skip and trustees in one state update
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
                htmlFor="skip_trustees"
                className="text-sm font-medium cursor-pointer leading-relaxed flex items-center gap-2"
              >
                {t('form:skipTrusteeCheckbox')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div onClick={(e) => e.preventDefault()}>
                        <Info className="h-3.5 w-3.5 text-[#888] hover:text-[#0C5536] transition-colors duration-200" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#0C5536] text-white border-[#0C5536]">
                      <p className="text-xs">
                        {t('form:skipTrusteeTooltip')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
          </div>

          {/* Validation Error Message - Below checkbox - Only show when skip is NOT checked */}
          {!localSkip && !skipTrustees && data.length === 0 && errors && Object.keys(errors).length > 0 && (
            <div className="mt-3 bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                {Object.values(errors)[0] || t('form:trusteeRequiredError')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conditional rendering: Only show form if NOT skipping */}
      {!localSkip && (
        <>
          {/* Trustee List */}
          <div className="space-y-6">
            {/* Render trustees grouped by level */}
            {[1, 2, 3].map((level) => {
              const levelTrustees = trusteesByLevel[level] || [];
              if (levelTrustees.length === 0) return null;

              return (
                <div key={level} className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2 bg-[#0C5536] text-white px-3 py-1.5 rounded-md">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-[13px] font-medium">
                        Level {level}
                      </span>
                    </div>
                    <span className="text-sm text-[#6B6B6B]">
                      {getLevelLabel(level)}
                    </span>
                  </div>

                  {levelTrustees.map((trustee, idx) => {
                    const globalIndex = sortedTrustees.indexOf(trustee);
                    return (
                      <Card
                        key={idx}
                        className="border-t-[3px] border-t-[#0C5536] shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-[#E6E6E4] bg-white rounded-lg"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-base">
                              {t('form:trusteeLabel')} {idx + 1}
                            </CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTrustee(trustee)}
                              className="text-[#C54848] hover:text-[#C54848] hover:bg-[rgba(197,72,72,0.05)] hover:underline h-auto p-2 text-[13px]"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('form:removeLabel')}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-7 pb-7 px-6 space-y-5">
                          {/* Name */}
                          <div className="space-y-2 relative">
                            <Label htmlFor={`trustee_name_${level}_${idx}`}>
                              {t('form:nameLabelRequired')}
                            </Label>
                            <div className="relative">
                              <Input
                                id={`trustee_name_${level}_${idx}`}
                                value={trustee.name}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                  handleTrusteeChange(
                                    trustee,
                                    "name",
                                    value
                                  );
                                }}
                                onFocus={() => setOpenDropdownId(`trustee_${globalIndex}`)}
                                placeholder={t('form:trusteePlaceholderName')}
                                className={cn(beneficiaries.length > 0 && "pr-10")}
                              />
                              {beneficiaries.length > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setOpenDropdownId(openDropdownId === `trustee_${globalIndex}` ? null : `trustee_${globalIndex}`)}
                                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                >
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                            {/* Beneficiaries Dropdown */}
                            {openDropdownId === `trustee_${globalIndex}` && beneficiaries.length > 0 && (() => {
                              // Get names already used in this step (excluding current trustee)
                              const usedNames = data
                                .filter(t => t !== trustee && t.name.trim())
                                .map(t => t.name.toLowerCase().trim());

                              // Filter beneficiaries based on current input and exclude already used
                              const searchTerm = trustee.name.toLowerCase().trim();
                              const filteredBeneficiaries = beneficiaries.filter(b =>
                                b.name.toLowerCase().includes(searchTerm) &&
                                !usedNames.includes(b.name.toLowerCase().trim())
                              );

                              // Only show dropdown if there are matches
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
                                      onClick={() => handleBeneficiarySelection(trustee, beneficiary)}
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
                            {errors[`trustees.${globalIndex}.name`] && (
                              <p className="text-sm text-destructive">
                                {errors[`trustees.${globalIndex}.name`]}
                              </p>
                            )}
                          </div>

                          {/* Relation */}
                          <div className="space-y-2">
                            <Label htmlFor={`trustee_relation_${level}_${idx}`}>
                              {t('form:relationLabelRequired')}
                            </Label>
                            <Input
                              id={`trustee_relation_${level}_${idx}`}
                              value={trustee.relation}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                handleTrusteeChange(
                                  trustee,
                                  "relation",
                                  value
                                );
                              }}
                              placeholder={t('form:trusteePlaceholderRelation')}
                            />
                            {errors[`trustees.${globalIndex}.relation`] && (
                              <p className="text-sm text-destructive">
                                {errors[`trustees.${globalIndex}.relation`]}
                              </p>
                            )}
                          </div>

                          {/* Email ID */}
                          <div className="space-y-2">
                            <Label htmlFor={`trustee_email_${level}_${idx}`}>
                              {t('form:emailIdLabelRequired')}
                            </Label>
                            <Input
                              id={`trustee_email_${level}_${idx}`}
                              type="email"
                              value={trustee.email}
                              onChange={(e) =>
                                handleTrusteeChange(
                                  trustee,
                                  "email",
                                  e.target.value
                                )
                              }
                              placeholder={t('form:trusteePlaceholderEmail')}
                              autoComplete="off"
                            />
                            {errors[`trustees.${globalIndex}.email`] && (
                              <p className="text-sm text-destructive">
                                {errors[`trustees.${globalIndex}.email`]}
                              </p>
                            )}
                          </div>

                          {/* Contact Number */}
                          <div className="space-y-2">
                            <Label htmlFor={`trustee_contact_${level}_${idx}`}>
                              {t('form:contactNumberLabelRequired')}
                            </Label>
                            <Input
                              id={`trustee_contact_${level}_${idx}`}
                              type="tel"
                              value={trustee.contact_number}
                              onChange={(e) =>
                                handleTrusteeChange(
                                  trustee,
                                  "contact_number",
                                  formatPhoneNumber(e.target.value)
                                )
                              }
                              placeholder={t('form:trusteePlaceholderContact')}
                            />
                            {errors[`trustees.${globalIndex}.contact_number`] && (
                              <p className="text-sm text-destructive">
                                {errors[`trustees.${globalIndex}.contact_number`]}
                              </p>
                            )}
                          </div>

                          {/* Trustee Passport Upload */}
                          {willId && (
                            <div className="md:col-span-2">
                              <PassportUploadSection
                                passportPath={trustee.passport_path}
                                passportNumber={trustee.passport_number || ''}
                                onPassportPathChange={(path) => handleTrusteeChange(trustee, 'passport_path', path)}
                                onPassportNumberChange={(number) => handleTrusteeChange(trustee, 'passport_number', number)}
                                onPassportDataChange={(data) => updateTrusteePassportData(trustee, data)}
                                onFileMetadataUpdate={onFileMetadataUpdate}
                                willId={willId}
                                uploadPath={`trustee-${level}-${idx}`}
                                stepName="Step 6: Trustees"
                                personName={trustee.name || ''}
                                personRole={`trustee-${level}-${idx}`}
                                label={t('form:passportLabel')}
                                error={errors?.[`trustees.${globalIndex}.passport_number`]}
                                passportError={errors?.[`trustees.${globalIndex}.passport_path`]}
                                disabled={shouldDisablePassportUpload(allAnswers, trustee.name || '')}
                                disabledMessage={getPassportDisabledMessage(allAnswers, trustee.name || '')}
                              />
                            </div>
                          )}

                          {/* Emirates ID Upload */}
                          {willId && (
                            <div className="md:col-span-2">
                              <EmiratesIdUpload
                                emiratesIdPath={trustee.emirates_id_path}
                                emiratesIdNumber={trustee.emirates_id_number}
                                onEmiratesIdPathChange={(path) => handleTrusteeChange(trustee, 'emirates_id_path', path)}
                                onEmiratesIdNumberChange={(number) => handleTrusteeChange(trustee, 'emirates_id_number', number)}
                                onEmiratesIdDataChange={(data) => updateTrusteeEmiratesIdData(trustee, data)}
                                onFileMetadataUpdate={onFileMetadataUpdate}
                                willId={willId}
                                uploadPath={`trustee-${level}-${idx}`}
                                stepName="Step 6: Trustees"
                                personName={trustee.name || ''}
                                personRole={`trustee-${level}-${idx}`}
                                label={t('form:emiratesIdLabel')}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Add Another at this Level Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddTrusteeAtLevel(level)}
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
                onClick={() => handleAddTrusteeAtLevel(2)}
                className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('form:addLevel2')} {getLevelLabel(2)}
              </Button>
            )}

            {hasLevel(2) && !hasLevel(3) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddTrusteeAtLevel(3)}
                className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('form:addLevel3')} {getLevelLabel(3)}
              </Button>
            )}

            {/* Empty State */}
            {data.length === 0 && (
              <Card className="border-dashed border-[#E6E6E4] bg-white">
                <CardContent className="pt-8 pb-8 text-center space-y-4">
                  <p className="text-sm text-[#6B6B6B]">
                    {t('form:noTrusteesYet')}
                  </p>
                  <Button
                    type="button"
                    onClick={handleAddTrustee}
                    className="bg-[#0C5536] text-white hover:bg-[#134A35] hover:shadow-[0_0_6px_rgba(198,160,59,0.35)] transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addFirstTrustee')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Permission Checkbox */}
          {data.length > 0 && (
            <Card className="bg-[#F8F8F6] border-[#E6E6E4]">
              <CardContent className="pt-5 pb-5 px-5">
                <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
                  <Checkbox
                    id="trustee_permission"
                    checked={permissionToContact}
                    className="rounded-sm mt-1.5"
                    onCheckedChange={(checked) =>
                      onPermissionChange?.(checked === true)
                    }
                  />
                  <div className="flex-1 space-y-2">
                    <Label
                      htmlFor="trustee_permission"
                      className="text-sm font-medium cursor-pointer leading-relaxed"
                    >
                      {t('form:permissionToContactTrustees')}
                    </Label>
                    <p className="text-xs text-[#6B6B6B] italic">
                      {t('form:trusteeContactNotice')}
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
              {t('form:skipTrusteeConfirmation')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
