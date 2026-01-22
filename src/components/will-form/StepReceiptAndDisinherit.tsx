import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, User, X, AlertCircle, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReceiptPerson, DisinheritPerson, FamilyExclusion, Answers, Beneficiary } from "@/types/will-form";
import { toast } from "@/hooks/use-toast";
import { formatPhoneNumber } from "@/utils/phoneValidation";
import { StepTitle } from "./StepTitle";
import { useTranslation } from "react-i18next";
import { PassportUploadSection } from "./PassportUploadSection";
import { EmiratesIdUpload } from "./EmiratesIdUpload";
import { findExistingPassport, shouldDisablePassportUpload, getPassportDisabledMessage } from "@/lib/passport-utils";

interface StepReceiptAndDisinheritProps {
  receiptData: ReceiptPerson[];
  onReceiptChange: (data: ReceiptPerson[]) => void;
  noReceiptPersons?: boolean;
  onNoReceiptChange: (value: boolean) => void;
  familyExclusion: FamilyExclusion;
  onFamilyExclusionChange: (data: FamilyExclusion) => void;
  disinheritData: DisinheritPerson[];
  onDisinheritChange: (data: DisinheritPerson[]) => void;
  noDisinheritPersons?: boolean;
  onNoDisinheritChange: (value: boolean) => void;
  permissionToContact?: boolean;
  onPermissionChange?: (permission: boolean) => void;
  errors?: Record<string, string>;
  willId?: string;
  allAnswers?: Answers;
  onFileMetadataUpdate?: (metadata: any) => void;
}

export function StepReceiptAndDisinherit({
  receiptData,
  onReceiptChange,
  noReceiptPersons = false,
  onNoReceiptChange,
  familyExclusion,
  onFamilyExclusionChange,
  disinheritData,
  onDisinheritChange,
  noDisinheritPersons = false,
  onNoDisinheritChange,
  permissionToContact = true,
  onPermissionChange,
  errors = {},
  willId,
  allAnswers,
  onFileMetadataUpdate,
}: StepReceiptAndDisinheritProps) {
  const { t, i18n } = useTranslation(["form", "common"]);
  const isRtl = i18n.language === 'ar';
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Get beneficiaries from allAnswers
  const beneficiaries: Beneficiary[] = allAnswers?.beneficiaries || [];


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

  // Auto-fill passports for receipt persons with matching names
  useEffect(() => {
    if (!allAnswers) return;

    let updated = false;
    const newData = receiptData.map(person => {
      if (!person.name?.trim() || (person.passport_path && person.passport_number)) {
        return person;
      }

      const existingPassport = findExistingPassport(allAnswers, person.name);
      if (existingPassport) {
        updated = true;
        return {
          ...person,
          passport_path: existingPassport.passport_path,
          passport_number: existingPassport.passport_number,
        };
      }

      return person;
    });

    if (updated) {
      onReceiptChange(newData);
    }
  }, [receiptData, allAnswers]);

  // Auto-fill passports for disinherit persons with matching names
  useEffect(() => {
    if (!allAnswers) return;

    let updated = false;
    const newData = disinheritData.map(person => {
      if (!person.name?.trim() || (person.passport_path && person.passport_number)) {
        return person;
      }

      const existingPassport = findExistingPassport(allAnswers, person.name);
      if (existingPassport) {
        updated = true;
        return {
          ...person,
          passport_path: existingPassport.passport_path,
          passport_number: existingPassport.passport_number,
        };
      }

      return person;
    });

    if (updated) {
      onDisinheritChange(newData);
    }
  }, [disinheritData, allAnswers]);

  const getReceiptError = (index: number, field: string) => {
    return (
      errors?.[`${index}.${field}`] ||
      errors?.[`receipt_of_will.${index}.${field}`]
    );
  };

  const getDisinheritError = (index: number, field: string) => {
    return (
      errors?.[`${index}.${field}`] || errors?.[`disinherit.${index}.${field}`]
    );
  };

  const topReceiptError =
    !noReceiptPersons && receiptData.length === 0
      ? t('form:receiptPersonRequiredError')
      : undefined;

  const topDisinheritError =
    !noDisinheritPersons && disinheritData.length === 0
      ? t('form:disinheritPersonRequiredError')
      : undefined;

  // Receipt Person Functions
  const addReceiptPersonAtLevel = (level: number) => {
    onReceiptChange([
      ...receiptData,
      {
        level,
        name: "",
        relation: "",
        passport_number: "",
        contact_number: "",
      },
    ]);
  };

  const addReceiptPerson = () => {
    addReceiptPersonAtLevel(1);
  };

  const removeReceiptPerson = (person: ReceiptPerson) => {
    onReceiptChange(receiptData.filter((p) => p !== person));
  };

  const updateReceiptPerson = (
    person: ReceiptPerson,
    field: keyof ReceiptPerson,
    value: string
  ) => {
    const updated = receiptData.map((p) =>
      p === person ? { ...p, [field]: value } : p
    );
    onReceiptChange(updated);
  };

  const updateReceiptPersonPassportData = (person: ReceiptPerson, passportData: { path?: string; number?: string }) => {
    const updated = receiptData.map((p) => p === person ? {
      ...p,
      passport_path: passportData.path,
      passport_number: passportData.number || '',
    } : p);
    onReceiptChange(updated);
  };

  const updateReceiptPersonEmiratesIdData = (person: ReceiptPerson, emiratesIdData: { path?: string; number?: string }) => {
    const updated = receiptData.map((p) => p === person ? {
      ...p,
      emirates_id_path: emiratesIdData.path,
      emirates_id_number: emiratesIdData.number || '',
    } : p);
    onReceiptChange(updated);
  };

  const handleReceiptBeneficiarySelection = (person: ReceiptPerson, beneficiary: Beneficiary) => {
    const updated = receiptData.map((p) =>
      p === person
        ? {
            ...p,
            name: beneficiary.name,
            relation: beneficiary.relationship,
            contact_number: beneficiary.contact_number,
            passport_path: beneficiary.passport_path,
            passport_number: beneficiary.passport_number,
            // Auto-fill Emirates ID from beneficiary
            emirates_id_path: beneficiary.emirates_id_path,
            emirates_id_number: beneficiary.emirates_id_number,
          }
        : p
    );
    onReceiptChange(updated);
    setOpenDropdownId(null);
  };

  // Disinherit Person Functions
  const addDisinheritPersonAtLevel = (level: number) => {
    onDisinheritChange([
      ...disinheritData,
      {
        level,
        name: "",
        relation: "",
        passport_number: "",
        contact_number: "",
      },
    ]);
  };

  const addDisinheritPerson = () => {
    addDisinheritPersonAtLevel(1);
  };

  const removeDisinheritPerson = (person: DisinheritPerson) => {
    onDisinheritChange(disinheritData.filter((p) => p !== person));
  };

  const updateDisinheritPerson = (
    person: DisinheritPerson,
    field: keyof DisinheritPerson,
    value: string
  ) => {
    const updated = disinheritData.map((p) =>
      p === person ? { ...p, [field]: value } : p
    );
    onDisinheritChange(updated);
  };

  const updateDisinheritPersonPassportData = (person: DisinheritPerson, passportData: { path?: string; number?: string }) => {
    const updated = disinheritData.map((p) => p === person ? {
      ...p,
      passport_path: passportData.path,
      passport_number: passportData.number || '',
    } : p);
    onDisinheritChange(updated);
  };

  const updateDisinheritPersonEmiratesIdData = (person: DisinheritPerson, emiratesIdData: { path?: string; number?: string }) => {
    const updated = disinheritData.map((p) => p === person ? {
      ...p,
      emirates_id_path: emiratesIdData.path,
      emirates_id_number: emiratesIdData.number || '',
    } : p);
    onDisinheritChange(updated);
  };

  const handleDisinheritBeneficiarySelection = (person: DisinheritPerson, beneficiary: Beneficiary) => {
    const updated = disinheritData.map((p) =>
      p === person
        ? {
            ...p,
            name: beneficiary.name,
            relation: beneficiary.relationship,
            contact_number: beneficiary.contact_number,
            passport_path: beneficiary.passport_path,
            passport_number: beneficiary.passport_number,
            // Auto-fill Emirates ID from beneficiary
            emirates_id_path: beneficiary.emirates_id_path,
            emirates_id_number: beneficiary.emirates_id_number,
          }
        : p
    );
    onDisinheritChange(updated);
    setOpenDropdownId(null);
  };

  // Receipt grouping
  const sortedReceipt = [...receiptData].sort((a, b) => (a.level || 1) - (b.level || 1));
  const hasReceiptLevel = (level: number) => receiptData.some((p) => p.level === level);
  const receiptByLevel = sortedReceipt.reduce((acc, person) => {
    const level = person.level || 1;
    if (!acc[level]) acc[level] = [];
    acc[level].push(person);
    return acc;
  }, {} as Record<number, ReceiptPerson[]>);

  // Disinherit grouping
  const sortedDisinherit = [...disinheritData].sort((a, b) => (a.level || 1) - (b.level || 1));
  const hasDisinheritLevel = (level: number) => disinheritData.some((p) => p.level === level);
  const disinheritByLevel = sortedDisinherit.reduce((acc, person) => {
    const level = person.level || 1;
    if (!acc[level]) acc[level] = [];
    acc[level].push(person);
    return acc;
  }, {} as Record<number, DisinheritPerson[]>);

  return (
    <div className="space-y-8 relative">
      {/* Section 1: Receipt of Will */}
      <div className="space-y-8">
        <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
          <StepTitle title={t("receiptOfYourWillTitle")} />

          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-[#333333]">
              {t('form:receiptWillSubtitle')}
            </p>
          </div>
        </div>

        {/* Skip Checkbox */}
        <Card className="bg-[#F8F8F6] border border-[#E6E6E4] rounded-md">
          <CardContent className="pt-4 pb-4 px-4">
            <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
              <Checkbox
                id="no_receipt_persons"
                checked={noReceiptPersons}
                className="rounded-sm mt-0.5"
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  onNoReceiptChange(isChecked);
                  if (isChecked) {
                    onReceiptChange([]);
                  }
                }}
              />
              <Label
                htmlFor="no_receipt_persons"
                className="text-sm font-medium cursor-pointer leading-relaxed"
              >
                {t('form:noReceiptPersonsCheckbox')}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Persons List */}
        {topReceiptError && (
          <p className="text-destructive text-sm">{topReceiptError}</p>
        )}
        {!noReceiptPersons && (
          <div className="space-y-6">
            {receiptData.length === 0 ? (
              <Card className="border-dashed border-[#E6E6E4] bg-white">
                <CardContent className="pt-8 pb-8 text-center space-y-4">
                  <p className="text-sm text-[#6B6B6B]">
                    {t('form:noAuthorisedPersonsYet')}
                  </p>
                  <Button
                    type="button"
                    onClick={addReceiptPerson}
                    className="bg-[#0C5536] text-white hover:bg-[#134A35] hover:shadow-[0_0_6px_rgba(198,160,59,0.35)] transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addAuthorisedPerson')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Render receipt persons grouped by level */}
                {[1, 2, 3].map((level) => {
                  const levelPersons = receiptByLevel[level] || [];
                  if (levelPersons.length === 0) return null;

                  return (
                    <div key={level} className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-2 bg-[#0C5536] text-white px-3 py-1.5 rounded-md">
                          <User className="w-3.5 h-3.5" />
                          <span className="text-[13px] font-medium">Level {level}</span>
                        </div>
                      </div>

                      {levelPersons.map((person, idx) => {
                        const globalIndex = sortedReceipt.indexOf(person);
                        return (
                          <Card
                            key={idx}
                            className="shadow-[0_2px_8px_rgba(12,85,54,0.05)] border border-[#E6E6E4] bg-white"
                          >
                            <CardContent className="pt-8 pb-8 px-10 space-y-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-medium">
                                  {t('form:authorisedPersonLabel')} {idx + 1}
                                </h3>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeReceiptPerson(person)}
                                  className="text-[#A12E2E] hover:text-[#A12E2E] hover:bg-[rgba(161,46,46,0.05)] -mr-2"
                                >
                                  <Trash2 className="w-4 h-4 mr-1.5" />
                                  <span className="text-sm">{t("common:remove")}</span>
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                  <Label htmlFor={`receipt_name_${level}_${idx}`}>{t('form:nameLabelRequired')}</Label>
                                  <div className="relative flex gap-2">
                                    <div className="relative flex-1">
                                      <Input
                                        id={`receipt_name_${level}_${idx}`}
                                        value={person.name}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                          updateReceiptPerson(person, "name", value);
                                        }}
                                        onClick={() => setOpenDropdownId(`receipt-${globalIndex}`)}
                                        placeholder={t('form:receiptPlaceholderName')}
                                        className={cn("pr-10", getReceiptError(globalIndex, "name") ? "border-destructive" : "")}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setOpenDropdownId(openDropdownId === `receipt-${globalIndex}` ? null : `receipt-${globalIndex}`)}
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                      >
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Dropdown */}
                                  {openDropdownId === `receipt-${globalIndex}` && (() => {
                                    // Get names already used in receipt section (excluding current person)
                                    const usedNames = receiptData
                                      .filter(p => p !== person && p.name.trim())
                                      .map(p => p.name.toLowerCase().trim());

                                    // Filter beneficiaries based on current input and exclude already used
                                    const searchTerm = person.name.toLowerCase();
                                    const filteredBeneficiaries = beneficiaries.filter(b =>
                                      b.name.toLowerCase().includes(searchTerm) &&
                                      !usedNames.includes(b.name.toLowerCase().trim())
                                    );

                                    if (filteredBeneficiaries.length === 0) return null;

                                    return (
                                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                                        {filteredBeneficiaries.map((beneficiary, bIdx) => (
                                          <button
                                            key={bIdx}
                                            type="button"
                                            onClick={() => handleReceiptBeneficiarySelection(person, beneficiary)}
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

                                  {getReceiptError(globalIndex, "name") && (
                                    <p className="text-sm text-destructive mt-1">{getReceiptError(globalIndex, "name")}</p>
                                  )}
                                </div>

                                <div>
                                  <Label htmlFor={`receipt_relation_${level}_${idx}`}>{t('form:relationLabelRequired')}</Label>
                                  <Input
                                    id={`receipt_relation_${level}_${idx}`}
                                    value={person.relation}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                      updateReceiptPerson(person, "relation", value);
                                    }}
                                    placeholder={t('form:receiptPlaceholderRelation')}
                                    className={getReceiptError(globalIndex, "relation") ? "border-destructive" : ""}
                                  />
                                  {getReceiptError(globalIndex, "relation") && (
                                    <p className="text-sm text-destructive mt-1">{getReceiptError(globalIndex, "relation")}</p>
                                  )}
                                </div>

                                <div>
                                  <Label htmlFor={`receipt_contact_${level}_${idx}`}>{t('form:contactNumberLabelRequired')}</Label>
                                  <Input
                                    id={`receipt_contact_${level}_${idx}`}
                                    type="tel"
                                    value={person.contact_number}
                                    onChange={(e) => updateReceiptPerson(person, "contact_number", formatPhoneNumber(e.target.value))}
                                    placeholder={t('form:receiptPlaceholderContact')}
                                    className={getReceiptError(globalIndex, "contact_number") ? "border-destructive" : ""}
                                  />
                                  {getReceiptError(globalIndex, "contact_number") && (
                                    <p className="text-sm text-destructive mt-1">{getReceiptError(globalIndex, "contact_number")}</p>
                                  )}
                                </div>

                                {/* Receipt Person Passport Upload */}
                                {willId && (
                                  <div className="md:col-span-2">
                                    <PassportUploadSection
                                      passportPath={person.passport_path}
                                      passportNumber={person.passport_number || ''}
                                      onPassportPathChange={(path) => updateReceiptPerson(person, 'passport_path', path)}
                                      onPassportNumberChange={(number) => updateReceiptPerson(person, 'passport_number', number)}
                                      onPassportDataChange={(data) => updateReceiptPersonPassportData(person, data)}
                                      onFileMetadataUpdate={onFileMetadataUpdate}
                                      willId={willId}
                                      uploadPath={`receipt-${level}-${idx}`}
                                      stepName="Step 9: Receipt & Disinherit"
                                      personName={person.name || ''}
                                      personRole={`receipt-${level}-${idx}`}
                                      label={t('form:passportLabel')}
                                      error={errors[`receipt_of_will.${globalIndex}.passport_number`]}
                                      passportError={errors[`receipt_of_will.${globalIndex}.passport_path`]}
                                      disabled={shouldDisablePassportUpload(allAnswers, person.name || '')}
                                      disabledMessage={getPassportDisabledMessage(allAnswers, person.name || '')}
                                    />
                                  </div>
                                )}

                                {/* Emirates ID Upload */}
                                {willId && (
                                  <div className="md:col-span-2">
                                    <EmiratesIdUpload
                                      emiratesIdPath={person.emirates_id_path}
                                      emiratesIdNumber={person.emirates_id_number}
                                      onEmiratesIdPathChange={(path) => updateReceiptPerson(person, 'emirates_id_path', path)}
                                      onEmiratesIdNumberChange={(number) => updateReceiptPerson(person, 'emirates_id_number', number)}
                                      onEmiratesIdDataChange={(data) => updateReceiptPersonEmiratesIdData(person, data)}
                                      onFileMetadataUpdate={onFileMetadataUpdate}
                                      willId={willId}
                                      uploadPath={`receipt-${level}-${idx}`}
                                      stepName="Step 9: Receipt & Disinherit"
                                      personName={person.name || ''}
                                      personRole={`receipt-${level}-${idx}`}
                                      label={t('form:emiratesIdLabel')}
                                    />
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addReceiptPersonAtLevel(level)}
                        className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('form:addAnotherAtLevel', { level })}
                      </Button>
                    </div>
                  );
                })}

                {/* Add Level 2 & 3 Buttons */}
                {hasReceiptLevel(1) && !hasReceiptLevel(2) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addReceiptPersonAtLevel(2)}
                    className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addLevel2')} {t('form:backup1Label')}
                  </Button>
                )}
                {hasReceiptLevel(2) && !hasReceiptLevel(3) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addReceiptPersonAtLevel(3)}
                    className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addLevel3')} {t('form:backup2Label')}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Section Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E6E6E4]"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#F8F8F6] px-4 text-[13px] italic text-[#6B6B6B]">
            {t('form:nextSectionFamilyExclusion')}
          </span>
        </div>
      </div>

      {/* Section 2: Family Exclusion */}
      <div className="space-y-8">
        <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
          <StepTitle title={t('form:familyExclusionCardTitle')} />
          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-[#333333]">
              {t('form:familyExclusionSubtitle')}
            </p>
            <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
              {t('form:familyExclusionNote')}
            </p>
          </div>
        </div>

        <Card className="border-t-[3px] border-t-[#0C5536] shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-[#E6E6E4] bg-white rounded-lg">
          <CardContent className="pt-7 pb-7 px-6 space-y-5">
            <div className="space-y-3">
              <Label className="text-[14px] font-medium text-[#333333]">
                {t('form:familyExclusionQuestion')}
              </Label>
              <RadioGroup
                value={familyExclusion.is_excluding ? "yes" : "no"}
                onValueChange={(value) =>
                  onFamilyExclusionChange({
                    ...familyExclusion,
                    is_excluding: value === "yes",
                    details: value === "no" ? "" : familyExclusion.details,
                  })
                }
                className="flex gap-6"
              >
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <RadioGroupItem value="yes" id="excluding-yes" />
                  <Label
                    htmlFor="excluding-yes"
                    className="font-normal cursor-pointer text-[14px]"
                  >
                    {t('common:yes')}
                  </Label>
                </div>
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <RadioGroupItem value="no" id="excluding-no" />
                  <Label
                    htmlFor="excluding-no"
                    className="font-normal cursor-pointer text-[14px]"
                  >
                    {t('common:no')}
                  </Label>
                </div>
              </RadioGroup>
              {errors?.family_exclusion?.is_excluding && (
                <p className="text-sm text-destructive mt-1">
                  {errors.family_exclusion.is_excluding}
                </p>
              )}
            </div>

            {familyExclusion.is_excluding && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="exclusion-details" className="text-[14px]">
                  {t('form:familyExclusionDetailsLabel')}
                </Label>
                <Textarea
                  id="exclusion-details"
                  value={familyExclusion.details || ""}
                  onChange={(e) =>
                    onFamilyExclusionChange({
                      ...familyExclusion,
                      details: e.target.value,
                    })
                  }
                  placeholder={t('form:familyExclusionDetailsPlaceholder')}
                  rows={4}
                  className={`min-h-[100px] resize-y ${(errors?.family_exclusion?.details || errors?.details) ? 'border-destructive' : ''}`}
                />
                {(errors?.family_exclusion?.details || errors?.details) && (
                  <p className="text-sm text-destructive mt-1">
                    {errors?.family_exclusion?.details || errors?.details}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Section Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E6E6E4]"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#F8F8F6] px-4 text-[13px] italic text-[#6B6B6B]">
            {t('form:nextSectionDisinherit')}
          </span>
        </div>
      </div>

      {/* Section 3: Disinherit */}
      <div className="space-y-8">
        <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
          <StepTitle title={t("disinheritTitle")} />

          <div className="space-y-3">
            <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
              {t('form:disinheritSubtitle1')}
            </p>
            <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
              {t('form:disinheritSubtitle2')}
            </p>
          </div>
        </div>

        {/* Skip Checkbox */}
        <Card className="bg-[#F8F8F6] border border-[#E6E6E4] rounded-md">
          <CardContent className="pt-4 pb-4 px-4">
            <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
              <Checkbox
                id="no_disinherit_persons"
                checked={noDisinheritPersons}
                className="rounded-sm mt-0.5"
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  onNoDisinheritChange(isChecked);
                  if (isChecked) {
                    onDisinheritChange([]);
                  }
                }}
              />
              <Label
                htmlFor="no_disinherit_persons"
                className="text-sm font-medium cursor-pointer leading-relaxed"
              >
                {t('form:noDisinheritPersonsCheckbox')}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Disinherit Persons List */}
        {topDisinheritError && (
          <p className="text-destructive text-sm">{topDisinheritError}</p>
        )}
        {!noDisinheritPersons && (
          <div className="space-y-6">
            {disinheritData.length === 0 ? (
              <Card className="border-dashed border-[#E6E6E4] bg-white">
                <CardContent className="pt-8 pb-8 text-center space-y-4">
                  <p className="text-sm text-[#6B6B6B]">
                    {t('form:noDisinheritedPersonsYet')}
                  </p>
                  <Button
                    type="button"
                    onClick={addDisinheritPerson}
                    className="bg-[#0C5536] text-white hover:bg-[#134A35] hover:shadow-[0_0_6px_rgba(198,160,59,0.35)] transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addDisinheritedPerson')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Render disinherit persons grouped by level */}
                {[1, 2, 3].map((level) => {
                  const levelPersons = disinheritByLevel[level] || [];
                  if (levelPersons.length === 0) return null;

                  return (
                    <div key={level} className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-2 bg-[#0C5536] text-white px-3 py-1.5 rounded-md">
                          <User className="w-3.5 h-3.5" />
                          <span className="text-[13px] font-medium">Level {level}</span>
                        </div>
                      </div>

                      {levelPersons.map((person, idx) => {
                        const globalIndex = sortedDisinherit.indexOf(person);
                        return (
                          <Card
                            key={idx}
                            className="shadow-[0_2px_8px_rgba(12,85,54,0.05)] border border-[#E6E6E4] bg-white"
                          >
                            <CardContent className="pt-8 pb-8 px-10 space-y-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-medium">
                                  {t('form:disinheritedPersonLabel')} {idx + 1}
                                </h3>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDisinheritPerson(person)}
                                  className="text-[#A12E2E] hover:text-[#A12E2E] hover:bg-[rgba(161,46,46,0.05)] -mr-2"
                                >
                                  <Trash2 className="w-4 h-4 mr-1.5" />
                                  <span className="text-sm">{t("common:remove")}</span>
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                  <Label htmlFor={`disinherit_name_${level}_${idx}`}>{t('form:nameLabelRequired')}</Label>
                                  <div className="relative flex gap-2">
                                    <div className="relative flex-1">
                                      <Input
                                        id={`disinherit_name_${level}_${idx}`}
                                        value={person.name}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                          updateDisinheritPerson(person, "name", value);
                                        }}
                                        onClick={() => setOpenDropdownId(`disinherit-${globalIndex}`)}
                                        placeholder={t('form:disinheritPlaceholderName')}
                                        className={cn("pr-10", getDisinheritError(globalIndex, "name") ? "border-destructive" : "")}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setOpenDropdownId(openDropdownId === `disinherit-${globalIndex}` ? null : `disinherit-${globalIndex}`)}
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                      >
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Dropdown */}
                                  {openDropdownId === `disinherit-${globalIndex}` && (() => {
                                    // Get names already used in disinherit section (excluding current person)
                                    const usedNames = disinheritData
                                      .filter(p => p !== person && p.name.trim())
                                      .map(p => p.name.toLowerCase().trim());

                                    // Filter beneficiaries based on current input and exclude already used
                                    const searchTerm = person.name.toLowerCase();
                                    const filteredBeneficiaries = beneficiaries.filter(b =>
                                      b.name.toLowerCase().includes(searchTerm) &&
                                      !usedNames.includes(b.name.toLowerCase().trim())
                                    );

                                    if (filteredBeneficiaries.length === 0) return null;

                                    return (
                                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                                        {filteredBeneficiaries.map((beneficiary, bIdx) => (
                                          <button
                                            key={bIdx}
                                            type="button"
                                            onClick={() => handleDisinheritBeneficiarySelection(person, beneficiary)}
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

                                  {getDisinheritError(globalIndex, "name") && (
                                    <p className="text-sm text-destructive mt-1">{getDisinheritError(globalIndex, "name")}</p>
                                  )}
                                </div>

                                <div>
                                  <Label htmlFor={`disinherit_relation_${level}_${idx}`}>{t('form:relationLabelRequired')}</Label>
                                  <Input
                                    id={`disinherit_relation_${level}_${idx}`}
                                    value={person.relation}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                      updateDisinheritPerson(person, "relation", value);
                                    }}
                                    placeholder={t('form:disinheritPlaceholderRelation')}
                                    className={getDisinheritError(globalIndex, "relation") ? "border-destructive" : ""}
                                  />
                                  {getDisinheritError(globalIndex, "relation") && (
                                    <p className="text-sm text-destructive mt-1">{getDisinheritError(globalIndex, "relation")}</p>
                                  )}
                                </div>

                                <div>
                                  <Label htmlFor={`disinherit_contact_${level}_${idx}`}>
                                    {t('form:contactNumberLabelRequired')}
                                  </Label>
                                  <Input
                                    id={`disinherit_contact_${level}_${idx}`}
                                    type="tel"
                                    value={person.contact_number || ""}
                                    onChange={(e) => updateDisinheritPerson(person, "contact_number", formatPhoneNumber(e.target.value))}
                                    placeholder={t('form:disinheritPlaceholderContact')}
                                    className={cn(
                                      getDisinheritError(globalIndex, "contact_number") &&
                                        "border-destructive"
                                    )}
                                  />
                                  {getDisinheritError(globalIndex, "contact_number") && (
                                    <p className="text-sm text-destructive mt-1">{getDisinheritError(globalIndex, "contact_number")}</p>
                                  )}
                                </div>

                                {/* Disinherit Person Passport Upload */}
                                {willId && (
                                  <div className="md:col-span-2">
                                    <PassportUploadSection
                                      passportPath={person.passport_path}
                                      passportNumber={person.passport_number || ''}
                                      onPassportPathChange={(path) => updateDisinheritPerson(person, 'passport_path', path)}
                                      onPassportNumberChange={(number) => updateDisinheritPerson(person, 'passport_number', number)}
                                      onPassportDataChange={(data) => updateDisinheritPersonPassportData(person, data)}
                                      onFileMetadataUpdate={onFileMetadataUpdate}
                                      willId={willId}
                                      uploadPath={`disinherit-${level}-${idx}`}
                                      stepName="Step 9: Receipt & Disinherit"
                                      personName={person.name || ''}
                                      personRole={`disinherit-${level}-${idx}`}
                                      label={t('form:passportLabel')}
                                      error={errors[`disinherit.${globalIndex}.passport_number`]}
                                      passportError={errors[`disinherit.${globalIndex}.passport_path`]}
                                      disabled={shouldDisablePassportUpload(allAnswers, person.name || '')}
                                      disabledMessage={getPassportDisabledMessage(allAnswers, person.name || '')}
                                    />
                                  </div>
                                )}

                                {/* Emirates ID Upload */}
                                {willId && (
                                  <div className="md:col-span-2">
                                    <EmiratesIdUpload
                                      emiratesIdPath={person.emirates_id_path}
                                      emiratesIdNumber={person.emirates_id_number}
                                      onEmiratesIdPathChange={(path) => updateDisinheritPerson(person, 'emirates_id_path', path)}
                                      onEmiratesIdNumberChange={(number) => updateDisinheritPerson(person, 'emirates_id_number', number)}
                                      onEmiratesIdDataChange={(data) => updateDisinheritPersonEmiratesIdData(person, data)}
                                      onFileMetadataUpdate={onFileMetadataUpdate}
                                      willId={willId}
                                      uploadPath={`disinherit-${level}-${idx}`}
                                      stepName="Step 9: Receipt & Disinherit"
                                      personName={person.name || ''}
                                      personRole={`disinherit-${level}-${idx}`}
                                      label={t('form:emiratesIdLabel')}
                                    />
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addDisinheritPersonAtLevel(level)}
                        className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('form:addAnotherAtLevel', { level })}
                      </Button>
                    </div>
                  );
                })}

                {/* Add Level 2 & 3 Buttons */}
                {hasDisinheritLevel(1) && !hasDisinheritLevel(2) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addDisinheritPersonAtLevel(2)}
                    className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addLevel2')} {t('form:backup1Label')}
                  </Button>
                )}
                {hasDisinheritLevel(2) && !hasDisinheritLevel(3) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addDisinheritPersonAtLevel(3)}
                    className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form:addLevel3')} {t('form:backup2Label')}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {errors.general && (
        <p className="text-destructive text-sm">{errors.general}</p>
      )}

      {/* Permission Checkbox */}
      <Card className="bg-[#F8F8F6] border border-[#E6E6E4] mt-6">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-2">
            <div className={`flex items-start gap-3 ${isRtl ? '' : ''}`}>
              <Checkbox
                id="receipt_disinherit_permission_to_contact"
                checked={permissionToContact}
                onCheckedChange={(checked) =>
                  onPermissionChange?.(checked === true)
                }
                className="rounded-sm mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="receipt_disinherit_permission_to_contact"
                  className="text-sm font-normal cursor-pointer leading-relaxed flex items-center gap-2"
                >
                  {t("permissionToContactReceiptDisinherit")}
                  <div
                    className="group relative inline-block"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Info className="w-4 h-4 text-[#6B6B6B] cursor-help" />
                    <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#0C5536] text-white text-xs rounded-lg shadow-lg z-10">
                      {t('form:receiptDisinheritTooltip')}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#0C5536]"></div>
                    </div>
                  </div>
                </Label>
                <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                  {t("receiptDisinheritContactNotice")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
