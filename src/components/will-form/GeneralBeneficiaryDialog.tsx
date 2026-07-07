import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PassportUploadSection } from "./PassportUploadSection";
import type { GeneralBeneficiary } from "@/types/will-form";
import { cn } from "@/lib/utils";

interface GeneralBeneficiaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (beneficiary: GeneralBeneficiary) => void;
  editingBeneficiary?: GeneralBeneficiary | null;
  willId?: string;
}

const RELATIONSHIP_OPTIONS = [
  { value: "Spouse", labelKey: "spouse" },
  { value: "Child", labelKey: "child" },
  { value: "Parent", labelKey: "parent" },
  { value: "Sibling", labelKey: "sibling" },
  { value: "Grandchild", labelKey: "grandchild" },
  { value: "Niece", labelKey: "niece" },
  { value: "Nephew", labelKey: "nephew" },
  { value: "In-law", labelKey: "inLaw" },
  { value: "Friend", labelKey: "friend" },
  { value: "Charity", labelKey: "charity" },
  { value: "Other", labelKey: "other" },
];

const KNOWN_RELATIONSHIP_VALUES = RELATIONSHIP_OPTIONS
  .filter((o) => o.value !== "Other")
  .map((o) => o.value);

export function GeneralBeneficiaryDialog({
  open,
  onOpenChange,
  onSave,
  editingBeneficiary,
  willId,
}: GeneralBeneficiaryDialogProps) {
  const { t, i18n } = useTranslation(["form"]);
  const isRtl = i18n.language === 'ar';

  const [formData, setFormData] = useState<GeneralBeneficiary>({
    id: crypto.randomUUID(),
    name: "",
    relationship: "",
    asset_description: "",
    passport_path: undefined,
    passport_number: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  // null = derive "Other" from the saved value; true/false = user override.
  const [otherRelationMode, setOtherRelationMode] = useState<boolean | null>(null);

  // Load editing beneficiary data when dialog opens
  useEffect(() => {
    setOtherRelationMode(null);
    if (editingBeneficiary) {
      setFormData(editingBeneficiary);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        name: "",
        relationship: "",
        asset_description: "",
        passport_path: undefined,
        passport_number: undefined,
      });
    }
    setErrors({});
  }, [editingBeneficiary, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("form:nameRequired");
    }

    if (!formData.relationship.trim()) {
      newErrors.relationship = t("form:relationshipRequired");
    }

    if (!formData.asset_description.trim()) {
      newErrors.asset_description = t("form:assetDescriptionRequired");
    }

    if (!formData.passport_path || !formData.passport_path.trim()) {
      newErrors.passport = t("form:passportRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className={cn(isRtl && "!text-right")}>
          <DialogTitle>
            {editingBeneficiary
              ? t("form:editGeneralBeneficiary")
              : t("form:addGeneralBeneficiary")}
          </DialogTitle>
          <DialogDescription>
            {t("form:generalBeneficiaryDialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div>
            <Label htmlFor="general-beneficiary-name">
              {t("form:generalBeneficiaryName")} *
            </Label>
            <Input
              id="general-beneficiary-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={t("form:enterName")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{errors.name}</p>
              </div>
            )}
          </div>

          {/* Relationship */}
          <div>
            <Label htmlFor="general-beneficiary-relationship">
              {t("form:generalBeneficiaryRelation")} *
            </Label>
            {(() => {
              const rel = formData.relationship || "";
              const isOther =
                otherRelationMode ??
                (rel !== "" && !KNOWN_RELATIONSHIP_VALUES.includes(rel));
              return (
                <>
                  <Select
                    value={isOther ? "Other" : rel}
                    onValueChange={(value) => {
                      if (value === "Other") {
                        setOtherRelationMode(true);
                        setFormData({ ...formData, relationship: "" });
                      } else {
                        setOtherRelationMode(false);
                        setFormData({ ...formData, relationship: value });
                      }
                    }}
                  >
                    <SelectTrigger
                      id="general-beneficiary-relationship"
                      className={cn(
                        errors.relationship ? "border-destructive" : "",
                        isRtl && "text-right"
                      )}
                    >
                      <SelectValue placeholder={t("form:selectRelationship")} />
                    </SelectTrigger>
                    <SelectContent className={cn(isRtl && "text-right")}>
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(`form:${option.labelKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isOther && (
                    <Input
                      className={cn("mt-2", isRtl && "text-right")}
                      placeholder={t("form:specifyRelation")}
                      value={rel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          relationship: e.target.value,
                        })
                      }
                    />
                  )}
                </>
              );
            })()}
            {errors.relationship && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{errors.relationship}</p>
              </div>
            )}
          </div>

          {/* Asset Description */}
          <div>
            <Label htmlFor="general-beneficiary-asset">
              {t("form:assetDescription")} *
            </Label>
            <Textarea
              id="general-beneficiary-asset"
              value={formData.asset_description}
              onChange={(e) =>
                setFormData({ ...formData, asset_description: e.target.value })
              }
              placeholder={t("form:assetDescriptionPlaceholder")}
              rows={4}
              className={errors.asset_description ? "border-destructive" : ""}
            />
            {errors.asset_description && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">
                  {errors.asset_description}
                </p>
              </div>
            )}
          </div>

          {/* Passport Upload (Required) */}
          {willId && (
            <div className="border-t pt-4">
              <PassportUploadSection
                passportPath={formData.passport_path}
                passportNumber={formData.passport_number || ""}
                onPassportPathChange={(path) =>
                  setFormData({ ...formData, passport_path: path })
                }
                onPassportNumberChange={(number) =>
                  setFormData({ ...formData, passport_number: number })
                }
                onPassportDataChange={(data) =>
                  setFormData({
                    ...formData,
                    passport_path: data.path,
                    passport_number: data.number || formData.passport_number || "",
                  })
                }
                willId={willId}
                uploadPath={`general-beneficiary-${formData.id}`}
                label={t("form:passport")}
                passportError={errors.passport}
              />
              {errors.passport && (
                <div className="flex items-center gap-1 mt-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive">{errors.passport}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {t("form:cancel")}
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white"
          >
            {editingBeneficiary ? t("form:saveChanges") : t("form:addBeneficiary")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
