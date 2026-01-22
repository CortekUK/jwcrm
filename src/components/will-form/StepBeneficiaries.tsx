import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Layers,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Beneficiary } from "@/types/will-form";
import { BeneficiaryDocUpload } from "./BeneficiaryDocUpload";
import { DocumentUploadSection } from "./DocumentUploadSection";
import { EmiratesIdUpload } from "./EmiratesIdUpload";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { StepTitle } from "./StepTitle";

import type { Answers } from "@/types/will-form";

interface StepBeneficiariesProps {
  data: Beneficiary[];
  onChange: (data: Beneficiary[]) => void;
  permissionToContact?: boolean;
  onPermissionChange?: (permission: boolean) => void;
  errors?: Record<string, string>;
  willId?: string;
  allAnswers?: Answers; // All form answers for passport recognition
  onFileMetadataUpdate?: (metadata: any) => void;
}

const RELATIONSHIP_OPTIONS = [
  { value: "Spouse", labelKey: "spouse" },
  { value: "Child", labelKey: "child" },
  { value: "Parent", labelKey: "parent" },
  { value: "Sibling", labelKey: "sibling" },
  { value: "Grandchild", labelKey: "grandchild" },
  { value: "Friend", labelKey: "friend" },
  { value: "Charity", labelKey: "charity" },
];

const JUST_WILLS_GREEN = "#006E51";

export function StepBeneficiaries({
  data = [],
  onChange,
  permissionToContact = true,
  onPermissionChange,
  errors = {},
  willId,
  allAnswers,
  onFileMetadataUpdate,
}: StepBeneficiariesProps) {
  const { t } = useTranslation(["form"]);

  const getError = (path: string) => errors?.[path];
  const getFieldError = (index: number, field: string) => {
    // Errors for this step are produced from parsing the array directly,
    // so keys look like "0.relationship" (not "beneficiaries.0.relationship").
    return (
      errors?.[`${index}.${field}`] ||
      errors?.[`beneficiaries.${index}.${field}`]
    );
  };

  // Filter out any invalid beneficiaries on load
  const validData = data.filter((b) => b.level && typeof b.level === "number");

  const addBeneficiaryAtLevel = (level: number) => {
    onChange([
      ...validData,
      {
        level,
        name: "",
        relationship: "",
        contact_number: "",
        email: "",
        percentage: 0,
        comments: "",
        identity_docs: [],
        passport_path: undefined,
        passport_number: "",
      },
    ]);
  };

  const removeBeneficiary = (beneficiary: Beneficiary) => {
    onChange(validData.filter((b) => b !== beneficiary));
  };

  const updateBeneficiary = (
    beneficiary: Beneficiary,
    field: keyof Beneficiary,
    value: any
  ) => {
    const updated = validData.map((b) =>
      b === beneficiary ? { ...b, [field]: value } : b
    );
    onChange(updated);
  };

  const updateBeneficiaryByIndex = (
    index: number,
    field: keyof Beneficiary,
    value: any
  ) => {
    // Use data prop directly to avoid stale state issues
    const updated = data.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    );

    onChange(updated);
  };

  const updateBeneficiaryPassportData = (
    index: number,
    passportData: { path?: string; number?: string }
  ) => {
    // Update both fields at once to avoid race conditions
    const updated = data.map((b, i) =>
      i === index
        ? {
            ...b,
            passport_path: passportData.path,
            passport_number: passportData.number || "",
          }
        : b
    );

    onChange(updated);
  };

  const updateBeneficiaryEmiratesIdData = (
    index: number,
    emiratesIdData: { path?: string; number?: string }
  ) => {
    // Update both fields at once to avoid race conditions
    const updated = data.map((b, i) =>
      i === index
        ? {
            ...b,
            emirates_id_path: emiratesIdData.path,
            emirates_id_number: emiratesIdData.number || "",
          }
        : b
    );

    onChange(updated);
  };

  // Calculate Level 1 total for progress bar
  const level1Beneficiaries = validData.filter((b) => b.level === 1);
  const level1Total = level1Beneficiaries.reduce(
    (sum, b) => sum + (b.percentage || 0),
    0
  );
  const isLevel1Complete = Math.abs(level1Total - 100) < 0.01;
  const noLevel1 = level1Beneficiaries.length === 0;
  const topError =
    errors.beneficiaries ||
    errors[""] ||
    (noLevel1 ? t("atLeastOneBeneficiaryRequired") : undefined);

  // Check which levels exist
  const hasLevel = (level: number) => validData.some((b) => b.level === level);

  return (
    <div className="space-y-8 relative">
      {/* Intro Section */}
      <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.4)]">
        <StepTitle title={t("beneficiaries")} />
        <div className="text-[14px] text-[#6B6B6B] leading-[1.7] space-y-4">
          <p>{t("beneficiariesIntro")}</p>

          <div>
            <p className="font-medium text-[#121212]">
              {t("primaryBeneficiaryTitle")}
            </p>
            <p>{t("primaryBeneficiaryDesc")}</p>
          </div>

          <div>
            <p className="font-medium text-[#121212]">
              {t("contingentBeneficiaryTitle")}
            </p>
            <p>{t("contingentBeneficiaryDesc")}</p>
          </div>
        </div>

        {topError && (
          <p className="text-destructive text-sm mt-2">{topError}</p>
        )}
      </div>

      {/* Level 1 Progress Bar */}
      {level1Beneficiaries.length > 0 && (
        <Card className="shadow-[0_2px_8px_rgba(12,85,54,0.05)] border border-[#E6E6E4] bg-white">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0C5536]" />
                <span className="text-sm font-medium text-[#121212]">
                  {t("level1AllocationTitle")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isLevel1Complete ? (
                  <>
                    <CheckCircle2
                      className="w-4 h-4"
                      style={{ color: JUST_WILLS_GREEN }}
                    />
                    <span className="text-xs font-medium text-[#134A35]">
                      {level1Total.toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-xs font-medium text-destructive">
                      {level1Total.toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            </div>

            <Progress
              value={level1Total}
              className={cn("h-3", isLevel1Complete && "[&>div]:bg-[#006E51]")}
            />

            <p
              className={cn(
                "text-xs font-medium",
                isLevel1Complete ? "" : "text-destructive"
              )}
              style={isLevel1Complete ? { color: JUST_WILLS_GREEN } : undefined}
            >
              {isLevel1Complete
                ? t("level1Complete")
                : t("level1Incomplete", {
                    current: level1Total.toFixed(1),
                    remaining: (100 - level1Total).toFixed(1),
                  })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Beneficiary Level Cards */}
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((level) => {
          const levelBeneficiaries = validData.filter((b) => b.level === level);

          // Don't show empty levels 2-5 that haven't been added yet
          if (levelBeneficiaries.length === 0 && level > 1) return null;

          // For Level 1, always show the card even if empty
          if (levelBeneficiaries.length === 0 && level === 1) {
            return (
              <Card
                key={level}
                className="shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-t-[3px] border-l-0 bg-white"
                style={{ borderTopColor: JUST_WILLS_GREEN }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#0C5536]" />
                        <CardTitle className="text-[16px] font-bold text-[#0C5536]">
                          {t("level")} {level}
                          <span className="text-sm font-normal text-[#6B6B6B] ml-2">
                            ({t("primary")})
                          </span>
                        </CardTitle>
                      </div>
                      <p className="text-sm text-[#6B6B6B] mt-1">
                        Main recipient of your estate.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => addBeneficiaryAtLevel(1)}
                      size="sm"
                      className="bg-[#0C5536] text-white hover:bg-[#134A35]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addLevel", { level: 1 })}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noLevel1BeneficiaryYet")}
                  </p>
                  {topError && (
                    <p className="text-destructive text-sm text-center">
                      {topError}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          }

          return (
            <Card
              key={level}
              className=" pb-5 px-2 shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-t-[3px] border-l-0 bg-white"
              style={{
                borderTopColor: level === 1 ? JUST_WILLS_GREEN : "#2E7C58",
              }}
            >
              <CardHeader className="pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#0C5536]" />
                    <CardTitle className="text-[16px] font-bold text-[#0C5536]">
                      {t("level")} {level}
                      {level === 1 && (
                        <span className="text-sm font-normal text-[#6B6B6B] ml-2">
                          ({t("primary")})
                        </span>
                      )}
                      {level > 1 && (
                        <span className="text-sm font-normal text-[#6B6B6B] ml-2">
                          ({t("contingent")})
                        </span>
                      )}
                    </CardTitle>
                  </div>
                  {level === 1 && (
                    <p className="text-sm text-[#6B6B6B] mt-1">
                      {t("mainRecipient")}
                    </p>
                  )}
                  {level > 1 && (
                    <p className="text-sm text-[#6B6B6B] mt-1">
                      {t("receivesEstateIfPreviousCannotInherit")}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="">
                <div className="pt-8 pb-8 px-10 space-y-6">
                  {levelBeneficiaries.map((beneficiary, idx) => {
                    const globalIndex = data.indexOf(beneficiary);
                    return (
                      <div
                        key={idx}
                        className="space-y-4"
                      >
                        {/* Header with Remove Button */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-medium">
                            Beneficiary {idx + 1}
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBeneficiary(beneficiary)}
                            className="text-[#A12E2E] hover:text-[#A12E2E] hover:bg-[rgba(161,46,46,0.05)] -mr-2"
                          >
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            <span className="text-sm">{t("removeThisEntry")}</span>
                          </Button>
                        </div>

                        {idx > 0 && <div className="border-t border-[#E6E6E4] -mt-4 mb-4" />}

                        {/* Name(s) */}
                        <div>
                          <Label htmlFor={`beneficiary_name_${level}_${idx}`}>
                            {t("nameLabel")} *
                          </Label>
                          <Input
                            id={`beneficiary_name_${level}_${idx}`}
                            value={beneficiary.name}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                              updateBeneficiary(
                                beneficiary,
                                "name",
                                value
                              );
                            }}
                            placeholder={t("namePlaceholder")}
                            className={cn(
                              getFieldError(globalIndex, "name") &&
                                "border-destructive"
                            )}
                          />
                          {getFieldError(globalIndex, "name") && (
                            <p className="text-destructive text-xs mt-1">
                              {getFieldError(globalIndex, "name")}
                            </p>
                          )}
                        </div>

                        {/* Relation */}
                        <div>
                          <Label
                            htmlFor={`beneficiary_relationship_${level}_${idx}`}
                          >
                            {t("relation")} *
                          </Label>
                          <Select
                            value={beneficiary.relationship}
                            onValueChange={(value) => {
                              updateBeneficiary(
                                beneficiary,
                                "relationship",
                                value
                              );
                            }}
                          >
                            <SelectTrigger
                              id={`beneficiary_relationship_${level}_${idx}`}
                              className={cn(
                                getFieldError(globalIndex, "relationship") &&
                                  "border-destructive"
                              )}
                            >
                              <SelectValue placeholder={t("selectRelation")} />
                            </SelectTrigger>
                            <SelectContent>
                              {RELATIONSHIP_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {t(`${option.labelKey}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {getFieldError(globalIndex, "relationship") && (
                            <p className="text-destructive text-xs mt-1">
                              {getFieldError(globalIndex, "relationship")}
                            </p>
                          )}
                        </div>

                        {/* Contact Number */}
                        <div>
                          <Label
                            htmlFor={`beneficiary_contact_${level}_${idx}`}
                          >
                            {t("contactNumber")} *
                          </Label>
                          <Input
                            id={`beneficiary_contact_${level}_${idx}`}
                            type="tel"
                            value={beneficiary.contact_number || ""}
                            onChange={(e) =>
                              updateBeneficiary(
                                beneficiary,
                                "contact_number",
                                e.target.value
                              )
                            }
                            placeholder={t("contactNumberPlaceholder")}
                            className={cn(
                              getFieldError(globalIndex, "contact_number") &&
                                "border-destructive"
                            )}
                          />
                          {getFieldError(globalIndex, "contact_number") && (
                            <p className="text-destructive text-xs mt-1">
                              {getFieldError(globalIndex, "contact_number")}
                            </p>
                          )}
                        </div>

                        {/* Email */}
                        <div>
                          <Label
                            htmlFor={`beneficiary_email_${level}_${idx}`}
                          >
                            {t("emailIdLabel")} *
                          </Label>
                          <Input
                            id={`beneficiary_email_${level}_${idx}`}
                            type="email"
                            value={beneficiary.email || ""}
                            onChange={(e) =>
                              updateBeneficiary(
                                beneficiary,
                                "email",
                                e.target.value
                              )
                            }
                            placeholder={t("emailPlaceholder")}
                            autoComplete="off"
                            className={cn(
                              getFieldError(globalIndex, "email") &&
                                "border-destructive"
                            )}
                          />
                          {getFieldError(globalIndex, "email") && (
                            <p className="text-destructive text-xs mt-1">
                              {getFieldError(globalIndex, "email")}
                            </p>
                          )}
                        </div>


                        {/* Percentage */}
                        <div>
                          <Label
                            htmlFor={`beneficiary_percentage_${level}_${idx}`}
                          >
                            {t("percentage")}{" "}
                            {level === 1 ? "*" : `(${t("optional")})`}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`beneficiary_percentage_${level}_${idx}`}
                              type="text"
                              inputMode="decimal"
                              value={beneficiary.percentage || ""}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                const numValue = value === "" ? 0 : parseFloat(value);
                                if (value === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 100)) {
                                  updateBeneficiary(
                                    beneficiary,
                                    "percentage",
                                    value === "" ? 0 : numValue
                                  );
                                }
                              }}
                              placeholder="0"
                              className={cn(
                                getFieldError(globalIndex, "percentage") &&
                                  "border-destructive"
                              )}
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                          {getFieldError(globalIndex, "percentage") && (
                            <p className="text-destructive text-xs mt-1">
                              {getFieldError(globalIndex, "percentage")}
                            </p>
                          )}
                          {level === 1 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("percentageHelper")}
                            </p>
                          )}
                        </div>

                        {/* Comments / Notes */}
                        <div>
                          <Label
                            htmlFor={`beneficiary_comments_${level}_${idx}`}
                            className="font-normal"
                          >
                            {t("comments")} ({t("optional")})
                          </Label>
                          <Textarea
                            id={`beneficiary_comments_${level}_${idx}`}
                            value={beneficiary.comments || ""}
                            onChange={(e) => {
                              updateBeneficiary(
                                beneficiary,
                                "comments",
                                e.target.value
                              );
                            }}
                            onBlur={(e) => {
                              const trimmed = e.target.value.trim();
                              if (trimmed !== e.target.value) {
                                updateBeneficiary(
                                  beneficiary,
                                  "comments",
                                  trimmed
                                );
                              }
                            }}
                            placeholder={t("commentsPlaceholder")}
                            rows={4}
                            className="min-h-[100px]"
                          />
                          {getFieldError(globalIndex, "comments") && (
                            <p className="text-destructive text-xs mt-1">
                              {getFieldError(globalIndex, "comments")}
                            </p>
                          )}
                        </div>

                        {/* Identity Document Upload */}
                        {willId &&
                          (() => {
                            return (
                              <div className="pt-4 mt-4 border-t border-[#E6E6E4]">
                                <BeneficiaryDocUpload
                                  beneficiaryIndex={globalIndex}
                                  documents={beneficiary.identity_docs || []}
                                  onChange={(docs) =>
                                    updateBeneficiary(
                                      beneficiary,
                                      "identity_docs",
                                      docs
                                    )
                                  }
                                  willId={willId}
                                  passportPath={beneficiary.passport_path}
                                  passportNumber={
                                    beneficiary.passport_number || ""
                                  }
                                  personName={beneficiary.name}
                                  allAnswers={allAnswers}
                                  onPassportPathChange={(path) =>
                                    updateBeneficiaryByIndex(
                                      globalIndex,
                                      "passport_path",
                                      path
                                    )
                                  }
                                  onPassportNumberChange={(number) =>
                                    updateBeneficiaryByIndex(
                                      globalIndex,
                                      "passport_number",
                                      number
                                    )
                                  }
                                  onPassportDataChange={(data) =>
                                    updateBeneficiaryPassportData(
                                      globalIndex,
                                      data
                                    )
                                  }
                                  onFileMetadataUpdate={onFileMetadataUpdate}
                                  stepName="Step 10: Beneficiaries"
                                  personRole={`beneficiary-${level}-${idx}`}
                                  error={getFieldError(globalIndex, "passport_number") || getFieldError(globalIndex, "passport_path")}
                                />

                                {/* Emirates ID Upload */}
                                {willId && (
                                  <div className="pt-4 mt-4">
                                    <EmiratesIdUpload
                                      emiratesIdPath={beneficiary.emirates_id_path}
                                      emiratesIdNumber={beneficiary.emirates_id_number}
                                      onEmiratesIdPathChange={(path) => updateBeneficiary(beneficiary, 'emirates_id_path', path)}
                                      onEmiratesIdNumberChange={(number) => updateBeneficiary(beneficiary, 'emirates_id_number', number)}
                                      onEmiratesIdDataChange={(data) => updateBeneficiaryEmiratesIdData(globalIndex, data)}
                                      onFileMetadataUpdate={onFileMetadataUpdate}
                                      willId={willId}
                                      uploadPath={`beneficiary-${level}-${idx}`}
                                      stepName="Step 10: Beneficiaries"
                                      personName={beneficiary.name || ''}
                                      personRole={`beneficiary-${level}-${idx}`}
                                      label={t('emiratesIdLabel')}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              {/* Add another at this level */}
              {levelBeneficiaries.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addBeneficiaryAtLevel(level)}
                  className="w-full mt-4 border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addAnotherAtLevel", { level })}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add Next Level Buttons */}
      <div className="space-y-3 mx-2">
        {hasLevel(1) && !hasLevel(2) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addBeneficiaryAtLevel(2)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)] flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            {t("addLevel", { level: 2 })} ({t("contingent")})
          </Button>
        )}

        {hasLevel(2) && !hasLevel(3) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addBeneficiaryAtLevel(3)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)] flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            {t("addLevel", { level: 3 })} ({t("contingent")})
          </Button>
        )}

        {hasLevel(3) && !hasLevel(4) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addBeneficiaryAtLevel(4)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)] flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            {t("addLevel", { level: 4 })} ({t("contingent")})
          </Button>
        )}

        {hasLevel(4) && !hasLevel(5) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addBeneficiaryAtLevel(5)}
            className="w-full border-[#0C5536] text-[#0C5536] hover:bg-[rgba(12,85,54,0.1)] flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            {t("addLevel", { level: 5 })} ({t("contingent")})
          </Button>
        )}
      </div>

      {/* Permission Checkbox */}
      <Card className="bg-[#F8F8F6] border border-[#E6E6E4] mt-6">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-2">
            <div className="flex items-start space-x-3 gap-3">
              <Checkbox
                id="beneficiary_permission_to_contact"
                checked={permissionToContact}
                onCheckedChange={(checked) =>
                  onPermissionChange?.(checked === true)
                }
                className="rounded-sm mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="beneficiary_permission_to_contact"
                  className="text-sm font-normal cursor-pointer leading-relaxed flex items-center gap-2"
                >
                  {t("permissionToContactBeneficiary")}
                  <div
                    className="group relative inline-block"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Info className="w-4 h-4 text-[#6B6B6B] cursor-help" />
                    <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#0C5536] text-white text-xs rounded-lg shadow-lg z-10">
                      {t('form:beneficiaryTooltip')}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#0C5536]"></div>
                    </div>
                  </div>
                </Label>
                <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                  {t("beneficiaryContactNotice")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
