import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Scale, Info, ChevronDown } from "lucide-react";
import type { Executor, Answers, Beneficiary } from "@/types/will-form";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatPhoneNumber } from "@/utils/phoneValidation";
import { StepTitle } from "./StepTitle";
import { PassportUploadSection } from "./PassportUploadSection";
import { EmiratesIdUpload } from "./EmiratesIdUpload";
import { DocumentUploadSection } from "./DocumentUploadSection";
import { findExistingPassport, shouldDisablePassportUpload, getPassportDisabledMessage } from "@/lib/passport-utils";
import { cn } from "@/lib/utils";

interface StepExecutorsProps {
  data: Executor[];
  onChange: (data: Executor[]) => void;
  permissionToContact?: boolean;
  onPermissionChange?: (permission: boolean) => void;
  errors?: Record<string, string>;
  willId?: string;
  allAnswers?: Answers;
  onFileMetadataUpdate?: (metadata: any) => void;
}

export function StepExecutors({
  data = [],
  onChange,
  permissionToContact = true,
  onPermissionChange,
  errors = {},
  willId,
  allAnswers,
  onFileMetadataUpdate,
}: StepExecutorsProps) {
  const { t } = useTranslation(["form", "common"]);
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

  // Auto-fill passports for executors with matching names
  useEffect(() => {
    if (!allAnswers) return;

    let updated = false;
    const newData = data.map(executor => {
      // Skip if already has passport or no name
      if (!executor.name?.trim() || (executor.passport_path && executor.passport_number)) {
        return executor;
      }

      // Check if passport exists for this name
      const existingPassport = findExistingPassport(allAnswers, executor.name);
      if (existingPassport) {
        updated = true;
        return {
          ...executor,
          passport_path: existingPassport.passport_path,
          passport_number: existingPassport.passport_number,
        };
      }

      return executor;
    });

    if (updated) {
      onChange(newData);
    }
  }, [allAnswers]);
  const getFieldError = (index: number, field: string) => {
    return (
      errors?.[`${index}.${field}`] || errors?.[`executors.${index}.${field}`]
    );
  };

  const topError =
    errors?.executors ||
    errors?.[""] ||
    (data.length === 0
      ? t("atLeastOneLevel1ExecutorRequired")
      : undefined);

  const addExecutorAtLevel = (level: number) => {
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

  const addExecutor = () => {
    // Default to adding at level 1
    addExecutorAtLevel(1);
  };

  const removeExecutor = (executor: Executor) => {
    onChange(data.filter((e) => e !== executor));
  };

  const updateExecutor = (executor: Executor, field: keyof Executor, value: any) => {
    const updated = data.map((e) =>
      e === executor ? { ...e, [field]: value } : e
    );
    onChange(updated);
  };

  // Sort executors by level
  const sortedExecutors = [...data].sort((a, b) => a.level - b.level);

  // Check which levels exist
  const hasLevel = (level: number) => data.some((e) => e.level === level);

  // Group executors by level
  const executorsByLevel = sortedExecutors.reduce((acc, executor) => {
    if (!acc[executor.level]) acc[executor.level] = [];
    acc[executor.level].push(executor);
    return acc;
  }, {} as Record<number, Executor[]>);

  const setExecutor = (executor: Executor, patch: Partial<Executor>) => {
    const updated = data.map((e) =>
      e === executor ? { ...e, ...patch } : e
    );
    onChange(updated);
  };

  const handleBeneficiarySelection = (executor: Executor, beneficiary: Beneficiary) => {
    // Auto-fill executor fields with beneficiary data
    const updated = data.map((e) =>
      e === executor
        ? {
            ...e,
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
        : e
    );
    onChange(updated);
    setOpenDropdownId(null);
  };

  const updateExecutorPassportData = (executor: Executor, passportData: { path?: string; number?: string }) => {
    const updated = data.map((e) => e === executor ? {
      ...e,
      passport_path: passportData.path,
      passport_number: passportData.number || '',
    } : e);

    onChange(updated);
  };

  const updateExecutorEmiratesIdData = (executor: Executor, emiratesIdData: { path?: string; number?: string }) => {
    const updated = data.map((e) => e === executor ? {
      ...e,
      emirates_id_path: emiratesIdData.path,
      emirates_id_number: emiratesIdData.number || '',
    } : e);

    onChange(updated);
  };

  return (
    <div className="space-y-8 relative">
      {/* Intro Section */}
      <div className="space-y-3 pb-6 border-b border-[rgba(198,160,59,0.4)]">
        <StepTitle title={t("form:executorsTitle")} />

        <p className="text-[14px] text-[#6B6B6B] leading-[1.4]">
          {t("form:executorsDescription")}
        </p>
        {topError && (
          <p className="text-destructive text-sm mt-2">{topError}</p>
        )}
      </div>

      {/* Executors List */}
      <div className="space-y-6">
        {/* Render executors grouped by level */}
        {[1, 2, 3].map((level) => {
          const levelExecutors = executorsByLevel[level] || [];
          if (levelExecutors.length === 0) return null;

          return (
            <div key={level} className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 bg-[#0C5536] text-white px-3 py-1.5 rounded-md">
                  <Scale className="w-3.5 h-3.5" />
                  <span className="text-[13px] font-medium">
                    {t("form:levelLabel")} {level}
                  </span>
                </div>
                <span className="text-sm text-[#6B6B6B]">
                  {level === 1 && t("form:primaryExecutorLabel")}
                  {level === 2 && t("form:backupExecutorLabel")}
                  {level === 3 && t("form:secondaryExecutorLabel")}
                </span>
              </div>

              {levelExecutors.map((executor, idx) => {
                const globalIndex = sortedExecutors.indexOf(executor);
                return (
                  <Card
                    key={idx}
                    className="shadow-[0_2px_8px_rgba(12,85,54,0.05)] border border-[#E6E6E4] bg-white"
                  >
                    <CardContent className="pt-8 pb-8 px-10 space-y-6">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-medium">
                          {t('form:executorLabel')} {idx + 1}
                        </h3>

                        {/* Remove Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExecutor(executor)}
                          className="text-[#A12E2E] hover:text-[#A12E2E] hover:bg-[rgba(161,46,46,0.05)] -mr-2"
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          <span className="text-sm">{t("common:remove")}</span>
                        </Button>
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <Label htmlFor={`executor_name_${level}_${idx}`}>
                            {t("form:nameLabelRequired")}
                          </Label>
                          <div className="relative">
                            <Input
                              id={`executor_name_${level}_${idx}`}
                              value={executor.name}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                                updateExecutor(executor, "name", value);
                              }}
                              onFocus={() => setOpenDropdownId(`executor_${globalIndex}`)}
                              placeholder={t("form:nameExecutorPlaceholder")}
                              className={cn(
                                getFieldError(globalIndex, "name") ? "border-destructive" : "",
                                "pr-10"
                              )}
                            />
                            {beneficiaries.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpenDropdownId(openDropdownId === `executor_${globalIndex}` ? null : `executor_${globalIndex}`)}
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              >
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                          {/* Beneficiaries Dropdown */}
                          {openDropdownId === `executor_${globalIndex}` && beneficiaries.length > 0 && (() => {
                            // Get names already used in this step (excluding current executor)
                            const usedNames = data
                              .filter(e => e !== executor && e.name.trim())
                              .map(e => e.name.toLowerCase().trim());

                            // Filter beneficiaries based on current input and exclude already used
                            const searchTerm = executor.name.toLowerCase().trim();
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
                                    onClick={() => handleBeneficiarySelection(executor, beneficiary)}
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
                          {getFieldError(globalIndex, "name") && (
                            <p className="text-sm text-destructive mt-1">
                              {getFieldError(globalIndex, "name")}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`executor_relation_${level}_${idx}`}>
                            {t("form:relationLabelRequired")}
                          </Label>
                          <Input
                            id={`executor_relation_${level}_${idx}`}
                            value={executor.relation}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                              updateExecutor(executor, "relation", value);
                            }}
                            placeholder={t("form:relationPlaceholder")}
                            className={
                              getFieldError(globalIndex, "relation")
                                ? "border-destructive"
                                : ""
                            }
                          />
                          {getFieldError(globalIndex, "relation") && (
                            <p className="text-sm text-destructive mt-1">
                              {getFieldError(globalIndex, "relation")}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`executor_email_${level}_${idx}`}>
                            {t("form:emailIdLabelRequired")}
                          </Label>
                          <Input
                            id={`executor_email_${level}_${idx}`}
                            type="email"
                            value={executor.email}
                            onChange={(e) =>
                              updateExecutor(executor, "email", e.target.value)
                            }
                            placeholder={t("form:emailIdPlaceholder")}
                            className={
                              getFieldError(globalIndex, "email") ? "border-destructive" : ""
                            }
                          />
                          {getFieldError(globalIndex, "email") && (
                            <p className="text-sm text-destructive mt-1">
                              {getFieldError(globalIndex, "email")}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`executor_contact_${level}_${idx}`}>
                            {t("form:contactNumberLabelRequired")}
                          </Label>
                          <Input
                            id={`executor_contact_${level}_${idx}`}
                            type="tel"
                            value={executor.contact_number}
                            onChange={(e) =>
                              updateExecutor(
                                executor,
                                "contact_number",
                                formatPhoneNumber(e.target.value)
                              )
                            }
                            placeholder="+971501234567"
                            className={
                              getFieldError(globalIndex, "contact_number")
                                ? "border-destructive"
                                : ""
                            }
                          />
                          {getFieldError(globalIndex, "contact_number") && (
                            <p className="text-sm text-destructive mt-1">
                              {getFieldError(globalIndex, "contact_number")}
                            </p>
                          )}
                        </div>

                        {/* Executor Passport Upload */}
                        {willId && (
                          <div className="md:col-span-2">
                            <PassportUploadSection
                              passportPath={executor.passport_path}
                              passportNumber={executor.passport_number || ''}
                              onPassportPathChange={(path) => updateExecutor(executor, 'passport_path', path)}
                              onPassportNumberChange={(number) => updateExecutor(executor, 'passport_number', number)}
                              onPassportDataChange={(data) => updateExecutorPassportData(executor, data)}
                              onFileMetadataUpdate={onFileMetadataUpdate}
                              willId={willId}
                              uploadPath={`executor-${level}-${idx}`}
                              stepName="Step 5: Executors"
                              personName={executor.name || ''}
                              personRole={`executor-${level}-${idx}`}
                              label={t('form:passportLabel')}
                              error={getFieldError(globalIndex, "passport_number")}
                              passportError={getFieldError(globalIndex, "passport_path")}
                              disabled={shouldDisablePassportUpload(allAnswers, executor.name || '')}
                              disabledMessage={getPassportDisabledMessage(allAnswers, executor.name || '')}
                            />
                          </div>
                        )}

                        {/* Emirates ID Upload */}
                        {willId && (
                          <div className="md:col-span-2">
                            <EmiratesIdUpload
                              emiratesIdPath={executor.emirates_id_path}
                              emiratesIdNumber={executor.emirates_id_number}
                              onEmiratesIdPathChange={(path) => updateExecutor(executor, 'emirates_id_path', path)}
                              onEmiratesIdNumberChange={(number) => updateExecutor(executor, 'emirates_id_number', number)}
                              onEmiratesIdDataChange={(data) => updateExecutorEmiratesIdData(executor, data)}
                              onFileMetadataUpdate={onFileMetadataUpdate}
                              willId={willId}
                              uploadPath={`executor-${level}-${idx}`}
                              stepName="Step 5: Executors"
                              personName={executor.name || ''}
                              personRole={`executor-${level}-${idx}`}
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
                onClick={() => addExecutorAtLevel(level)}
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
            onClick={() => addExecutorAtLevel(2)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('form:addLevel2')} {t("form:backupExecutorLabel")}
          </Button>
        )}

        {hasLevel(2) && !hasLevel(3) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addExecutorAtLevel(3)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('form:addLevel3')} {t("form:secondaryExecutorLabel")}
          </Button>
        )}

        {/* Empty State */}
        {data.length === 0 && (
          <Card className="border-dashed border-[#E6E6E4] bg-white">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-[#6B6B6B] text-sm">
                {t("form:noExecutorsYet")}
              </p>
              <Button
                type="button"
                onClick={addExecutor}
                className="bg-[#0C5536] text-white hover:bg-[#134A35]"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("common:add")} {t("form:executorsTitle").slice(0, -1)}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Permission Checkbox */}
      <Card className="bg-[#F8F8F6] border border-[#E6E6E4]">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-2">
            <div className="flex items-start space-x-3 gap-3">
              <Checkbox
                id="permission_to_contact"
                checked={permissionToContact}
                onCheckedChange={(checked) =>
                  onPermissionChange?.(checked === true)
                }
                className="rounded-sm mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="permission_to_contact"
                  className="text-sm font-normal cursor-pointer leading-relaxed flex items-center gap-2"
                >
                  {t("form:permissionToContactExecutor")}
                  <div
                    className="group relative inline-block"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Info className="w-4 h-4 text-[#6B6B6B] cursor-help" />
                    <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#0C5536] text-white text-xs rounded-lg shadow-lg z-10">
                      {t('form:executorTooltip')}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#0C5536]"></div>
                    </div>
                  </div>
                </Label>
                <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                  {t("form:executorContactNotice")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
