import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, AlertCircle, Check, Edit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Asset, Beneficiary, GeneralBeneficiary } from "@/types/will-form";
import { toast } from "@/hooks/use-toast";
import { StepTitle } from "./StepTitle";
import { useTranslation } from "react-i18next";
import { AssetPhotoUpload } from "./AssetPhotoUpload";
import { AssetDocumentUpload } from "./AssetDocumentUpload";
import { GeneralBeneficiaryDialog } from "./GeneralBeneficiaryDialog";
import { cn } from "@/lib/utils";

interface StepAssetsProps {
  data: Asset[];
  onChange: (data: Asset[]) => void;
  errors?: Record<string, string>;
  beneficiaries?: Beneficiary[];
  willId?: string;
  willType?: 'general' | 'specific';
  onWillTypeChange?: (type: 'general' | 'specific') => void;
  mainBeneficiaryIds?: string[];
  onMainBeneficiariesChange?: (ids: string[]) => void;
  generalBeneficiaries?: GeneralBeneficiary[];
  onGeneralBeneficiariesChange?: (beneficiaries: GeneralBeneficiary[]) => void;
}

const ASSET_TYPES = [
  { value: 'property', labelKey: 'assetTypeProperty' },
  { value: 'bank', labelKey: 'assetTypeBankAccount' },
  { value: 'investments', labelKey: 'assetTypeInvestments' },
  { value: 'business', labelKey: 'assetTypeBusiness' },
  { value: 'vehicle', labelKey: 'assetTypeVehicle' },
  { value: 'crypto', labelKey: 'assetTypeCryptocurrency' },
  { value: 'personal', labelKey: 'assetTypePersonalItems' },
];

export function StepAssets({ data, onChange, errors = {}, beneficiaries = [], willId, willType = 'general', onWillTypeChange, mainBeneficiaryIds = [], onMainBeneficiariesChange, generalBeneficiaries = [], onGeneralBeneficiariesChange }: StepAssetsProps) {
  const { t, i18n } = useTranslation(["form"]);
  const isRtl = i18n.language === 'ar';

  // Dialog state for general beneficiaries
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<GeneralBeneficiary | null>(null);

  // Auto-select all beneficiaries by default when first loaded or when beneficiaries change
  // Also clean up stale beneficiary IDs that don't exist in current beneficiaries list
  useEffect(() => {
    if (willType === 'general' && beneficiaries.length > 0 && onMainBeneficiariesChange) {
      const validBeneficiaryNames = beneficiaries.map(b => b.name).filter(name => name && name.trim());

      // Clean up stale IDs - remove any that don't exist in current beneficiaries
      const validSelectedIds = mainBeneficiaryIds.filter(id => validBeneficiaryNames.includes(id));

      // If no valid selections, auto-select all
      if (validSelectedIds.length === 0 && validBeneficiaryNames.length > 0) {
        onMainBeneficiariesChange(validBeneficiaryNames);
      }
      // If some selections are invalid (stale), clean them up
      else if (validSelectedIds.length !== mainBeneficiaryIds.length) {
        onMainBeneficiariesChange(validSelectedIds);
      }
    }
  }, [beneficiaries, willType, mainBeneficiaryIds, onMainBeneficiariesChange]);

  const toggleBeneficiary = (beneficiaryName: string) => {
    if (!onMainBeneficiariesChange) return;

    const isSelected = mainBeneficiaryIds.includes(beneficiaryName);
    if (isSelected) {
      // Prevent deselecting if it's the last one
      if (mainBeneficiaryIds.length <= 1) {
        toast({
          title: "Cannot deselect",
          description: "At least one beneficiary must be selected.",
          variant: "destructive",
        });
        return;
      }
      onMainBeneficiariesChange(mainBeneficiaryIds.filter(id => id !== beneficiaryName));
    } else {
      onMainBeneficiariesChange([...mainBeneficiaryIds, beneficiaryName]);
    }
  };

  const addAsset = () => {
    onChange([
      ...data,
      {
        id: crypto.randomUUID(),
        title: '',
        category: 'property',
        description: '',
        location: '',
        beneficiary_name: '',
        documents: [],
        photo_path: undefined,
      },
    ]);
  };

  const removeAsset = (asset: Asset) => {
    onChange(data.filter(a => a !== asset));
  };

  const updateAsset = (asset: Asset, field: keyof Asset, value: any) => {
    const updated = data.map(a => a === asset ? { ...a, [field]: value } : a);
    onChange(updated);
  };

  // General Beneficiary handlers
  const handleAddGeneralBeneficiary = () => {
    setEditingBeneficiary(null);
    setDialogOpen(true);
  };

  const handleEditGeneralBeneficiary = (beneficiary: GeneralBeneficiary) => {
    setEditingBeneficiary(beneficiary);
    setDialogOpen(true);
  };

  const handleSaveGeneralBeneficiary = (beneficiary: GeneralBeneficiary) => {
    if (!onGeneralBeneficiariesChange) return;

    if (editingBeneficiary) {
      // Update existing
      const updated = generalBeneficiaries.map(b =>
        b.id === beneficiary.id ? beneficiary : b
      );
      onGeneralBeneficiariesChange(updated);
    } else {
      // Add new
      onGeneralBeneficiariesChange([...generalBeneficiaries, beneficiary]);
    }
  };

  const handleRemoveGeneralBeneficiary = (id: string) => {
    if (!onGeneralBeneficiariesChange) return;
    onGeneralBeneficiariesChange(generalBeneficiaries.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-8 relative">
      {/* Section Heading */}
      <StepTitle title={t("assets")} />

      {/* Will Type Selection */}
      <Card className="border-t-[3px] border-t-[#0C5536] shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-[#E6E6E4] bg-white rounded-lg">
        <CardContent className="pt-7 pb-7 px-6 space-y-4">
          <h3 className="text-[15px] font-semibold text-[#121212] mb-4">
            {t("chooseWillType")} *
          </h3>
          {errors['will_type'] && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2 -mt-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{errors['will_type']}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onWillTypeChange?.('general')}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                willType === 'general'
                  ? 'border-accent bg-accent/5'
                  : 'border-[#E6E6E4] hover:border-accent/50'
              } ${isRtl ? 'text-right' : 'text-left'}`}
            >
              <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  willType === 'general' ? 'border-accent' : 'border-[#D9D9D6]'
                }`}>
                  {willType === 'general' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#121212] mb-1">{t("generalWillTitle")}</h4>
                  <p className="text-sm text-[#6B6B6B]">
                    {t("generalWillDesc")}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onWillTypeChange?.('specific')}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                willType === 'specific'
                  ? 'border-accent bg-accent/5'
                  : 'border-[#E6E6E4] hover:border-accent/50'
              } ${isRtl ? 'text-right' : 'text-left'}`}
            >
              <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  willType === 'specific' ? 'border-accent' : 'border-[#D9D9D6]'
                }`}>
                  {willType === 'specific' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#121212] mb-1">{t("specificWillTitle")}</h4>
                  <p className="text-sm text-[#6B6B6B]">
                    {t("specificWillDesc")}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {willType === 'specific' && (
        <>
          <p className="text-[0.95rem] text-[#5C5C5C] -mt-2">
            {t("listAssetsSpecificWill")}
          </p>
          {errors['assets'] && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2 -mt-1">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{errors['assets']}</p>
            </div>
          )}
        </>
      )}

      {willType === 'general' && (
        <>
          <Card className="border-t-[3px] border-t-[#0C5536] shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-[#E6E6E4] bg-white rounded-lg -mt-2">
            <CardContent className="pt-7 pb-7 px-6 space-y-4">
              <h3 className="text-[15px] font-semibold text-[#121212] mb-2">
                {t("mainBeneficiaries")}
              </h3>
              <p className="text-sm text-[#6B6B6B] mb-4">
                {t("selectMainBeneficiaries")}
              </p>

              {errors['main_beneficiary_ids'] && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">{errors['main_beneficiary_ids']}</p>
                </div>
              )}

              {beneficiaries && beneficiaries.length > 0 ? (
                <div className="space-y-3">
                  {beneficiaries.map((beneficiary, index) => {
                    const isSelected = mainBeneficiaryIds.includes(beneficiary.name);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleBeneficiary(beneficiary.name)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/5'
                            : 'border-[#E6E6E4] hover:border-accent/50'
                        } ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                          isSelected ? 'border-accent bg-accent' : 'border-[#D9D9D6]'
                        }`}>
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                            <h4 className="font-medium text-[#121212]">{beneficiary.name}</h4>
                            <span className="text-sm text-[#6B6B6B]">({beneficiary.relationship})</span>
                          </div>
                          <p className="text-sm text-accent font-medium mt-1">
                            {beneficiary.percentage}% {t("ofEstate")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    {t("noBeneficiariesFound")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className={`bg-[#F8F8F6] p-4 ${isRtl ? 'border-r-4 border-[#0C5536] rounded-l' : 'border-l-4 border-[#0C5536] rounded-r'}`}>
            <p className="text-sm text-[#6B6B6B]">
              {t("generalWillNote")}
            </p>
          </div>

          {/* General Beneficiaries Section */}
          <Card className="border-t-[3px] border-t-[#C6A03B] shadow-[0_1px_4px_rgba(198,160,59,0.05)] border-[#E6E6E4] bg-white rounded-lg">
            <CardContent className="pt-7 pb-7 px-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#121212]">
                    {t("generalBeneficiaries")}
                  </h3>
                  <p className="text-sm text-[#6B6B6B] mt-1">
                    {t("generalBeneficiariesDesc")}
                  </p>
                </div>
              </div>

              {generalBeneficiaries && generalBeneficiaries.length > 0 ? (
                <div className="space-y-3">
                  {generalBeneficiaries.map((beneficiary) => (
                    <Card key={beneficiary.id} className="shadow-sm">
                      <CardContent className="pt-4 pb-4 px-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <h4 className="font-medium text-[#121212]">{beneficiary.name}</h4>
                              <span className="text-sm text-[#6B6B6B]">({beneficiary.relationship})</span>
                            </div>
                            <p className="text-sm text-[#6B6B6B] mt-2">
                              <span className="font-medium">{t("assetToReceive")}:</span> {beneficiary.asset_description}
                            </p>
                            {beneficiary.passport_number && (
                              <p className="text-xs text-[#6B6B6B] mt-1">
                                {t("passportNo")}: {beneficiary.passport_number}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditGeneralBeneficiary(beneficiary)}
                              className="h-8 w-8 text-muted-foreground hover:text-white"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveGeneralBeneficiary(beneficiary.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-[#F8F8F6] border border-[#E6E6E4] rounded-lg p-4 text-center">
                  <p className="text-sm text-[#6B6B6B]">
                    {t("noGeneralBeneficiariesYet")}
                  </p>
                </div>
              )}

              <Button
                type="button"
                onClick={handleAddGeneralBeneficiary}
                variant="outline"
                className="w-full border-[#C6A03B] text-[#C6A03B] hover:bg-[#C6A03B]/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addGeneralBeneficiary")}
              </Button>
            </CardContent>
          </Card>

        </>
      )}

      {/* Assets List for Specific Will */}
      {willType === 'specific' && (
        <>
          {data.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center space-y-3">
                <p className="text-muted-foreground">{t("noAssetsAddedYet")}</p>
                <Button type="button" onClick={addAsset} className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addAsset")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
          {data.map((asset, index) => (
            <Card key={index} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {t("assetNumber", { number: index + 1 })}
                    {asset.category && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground capitalize">
                        ({t(ASSET_TYPES.find(t => t.value === asset.category)?.labelKey || asset.category)})
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAsset(asset)}
                    className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Asset Title/Name */}
                <div>
                  <Label htmlFor={`asset_title_${index}`}>{t("assetTitleLabel")} *</Label>
                  <Input
                    id={`asset_title_${index}`}
                    value={asset.title || ''}
                    onChange={(e) => updateAsset(asset, 'title', e.target.value)}
                    placeholder={t("assetTitlePlaceholder")}
                    className={errors[`assets.${index}.title`] ? 'border-destructive' : ''}
                  />
                  {errors[`assets.${index}.title`] && (
                    <p className="text-sm text-destructive mt-1">{errors[`assets.${index}.title`]}</p>
                  )}
                </div>

                {/* Asset Type */}
                <div>
                  <Label htmlFor={`asset_category_${index}`}>{t("assetTypeLabel")}</Label>
                  <Select
                    value={asset.category}
                    onValueChange={(value: any) => updateAsset(asset, 'category', value)}
                  >
                    <SelectTrigger
                      id={`asset_category_${index}`}
                      className={cn(
                        errors[`assets.${index}.category`] ? 'border-destructive' : '',
                        isRtl && 'text-right'
                      )}
                    >
                      <SelectValue placeholder={t("selectAssetType")} />
                    </SelectTrigger>
                    <SelectContent className={cn(isRtl && 'text-right')}>
                      {ASSET_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {t(type.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[`assets.${index}.category`] && (
                    <p className="text-sm text-destructive mt-1">{errors[`assets.${index}.category`]}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor={`asset_description_${index}`}>{t("descriptionLabel")}</Label>
                  <Textarea
                    id={`asset_description_${index}`}
                    className={errors[`assets.${index}.description`] ? 'border-destructive' : ''}
                    value={asset.description}
                    onChange={(e) => updateAsset(asset, 'description', e.target.value)}
                    placeholder={t("assetDescriptionPlaceholder")}
                    rows={3}
                  />
                  {errors[`assets.${index}.description`] && (
                    <p className="text-sm text-destructive mt-1">{errors[`assets.${index}.description`]}</p>
                  )}
                </div>

                {/* Beneficiary Linking */}
                {beneficiaries.length > 0 && (
                  <div>
                    <Label htmlFor={`asset_beneficiary_${index}`}>{t("linkedBeneficiaryLabel")}</Label>
                    <Select
                      value={asset.beneficiary_name || 'none'}
                      onValueChange={(value) => updateAsset(asset, 'beneficiary_name', value === 'none' ? '' : value)}
                    >
                      <SelectTrigger id={`asset_beneficiary_${index}`}>
                        <SelectValue placeholder={t("selectBeneficiary")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noBeneficiaryLinked")}</SelectItem>
                        {beneficiaries.filter(b => b.name && b.name.trim()).map((beneficiary, idx) => (
                          <SelectItem key={idx} value={beneficiary.name}>
                            {beneficiary.name} {beneficiary.relationship ? `(${beneficiary.relationship})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("beneficiaryLinkHelper")}
                    </p>
                  </div>
                )}

                {/* Location */}
                <div>
                  <Label htmlFor={`asset_location_${index}`}>{t("locationLabel")}</Label>
                  <Input
                    id={`asset_location_${index}`}
                    value={asset.location || ''}
                    onChange={(e) => updateAsset(asset, 'location', e.target.value)}
                    placeholder={t("locationPlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("locationHelper")}
                  </p>
                </div>

                {/* Photo Upload */}
                {willId && asset.id && (
                  <div className="pt-4 border-t">
                    <AssetPhotoUpload
                      assetId={asset.id}
                      willId={willId}
                      photoPath={asset.photo_path}
                      onPhotoChange={(path) => updateAsset(asset, 'photo_path', path)}
                    />
                  </div>
                )}

                {/* Document Upload */}
                {willId && asset.id && (
                  <div className="pt-4 border-t">
                    <AssetDocumentUpload
                      assetId={asset.id}
                      willId={willId}
                      documents={asset.documents || []}
                      onDocumentsChange={(docs) => updateAsset(asset, 'documents', docs)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

              <Button type="button" variant="outline" onClick={addAsset} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {t('form:addAnotherAsset')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Optional Assets List for General Will */}
      {willType === 'general' && (
        <>
          <div className="border-t border-[#E6E6E4] pt-6">
            <h3 className="text-[15px] font-semibold text-[#121212] mb-2">
              {t("assetsTitle")} <span className="text-sm font-normal text-[#6B6B6B]">({t("optional")})</span>
            </h3>
            <p className="text-sm text-[#6B6B6B] mb-4">
              {t("assetsDescription")}
            </p>
          </div>

          {data.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center space-y-3">
                <p className="text-muted-foreground">{t("noAssetsAddedYet")}</p>
                <Button type="button" onClick={addAsset} className="bg-[#0C5536] hover:bg-[#0C5536]/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addAsset")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.map((asset, index) => (
                <Card key={index} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Asset {index + 1}
                        {asset.category && (
                          <span className="ml-2 text-sm font-normal text-muted-foreground capitalize">
                            ({t(ASSET_TYPES.find(t => t.value === asset.category)?.labelKey || asset.category)})
                          </span>
                        )}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAsset(asset)}
                        className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Asset Title/Name */}
                    <div>
                      <Label htmlFor={`asset_title_${index}`}>{t("assetTitleLabel")} *</Label>
                      <Input
                        id={`asset_title_${index}`}
                        value={asset.title || ''}
                        onChange={(e) => updateAsset(asset, 'title', e.target.value)}
                        placeholder={t("assetTitlePlaceholder")}
                        className={errors[`assets.${index}.title`] ? 'border-destructive' : ''}
                      />
                      {errors[`assets.${index}.title`] && (
                        <p className="text-sm text-destructive mt-1">{errors[`assets.${index}.title`]}</p>
                      )}
                    </div>

                    {/* Asset Type */}
                    <div>
                      <Label htmlFor={`asset_category_${index}`}>{t("assetTypeLabel")}</Label>
                      <Select
                        value={asset.category}
                        onValueChange={(value: any) => updateAsset(asset, 'category', value)}
                      >
                        <SelectTrigger
                          id={`asset_category_${index}`}
                          className={cn(
                            errors[`assets.${index}.category`] ? 'border-destructive' : '',
                            isRtl && 'text-right'
                          )}
                        >
                          <SelectValue placeholder={t("selectAssetType")} />
                        </SelectTrigger>
                        <SelectContent className={cn(isRtl && 'text-right')}>
                          {ASSET_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {t(type.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`assets.${index}.category`] && (
                        <p className="text-sm text-destructive mt-1">{errors[`assets.${index}.category`]}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <Label htmlFor={`asset_description_${index}`}>{t("descriptionLabel")}</Label>
                      <Textarea
                        id={`asset_description_${index}`}
                        className={errors[`assets.${index}.description`] ? 'border-destructive' : ''}
                        value={asset.description}
                        onChange={(e) => updateAsset(asset, 'description', e.target.value)}
                        placeholder={t("assetDescriptionPlaceholder")}
                        rows={3}
                      />
                      {errors[`assets.${index}.description`] && (
                        <p className="text-sm text-destructive mt-1">{errors[`assets.${index}.description`]}</p>
                      )}
                    </div>

                    {/* Location */}
                    <div>
                      <Label htmlFor={`asset_location_${index}`}>{t("locationLabel")}</Label>
                      <Input
                        id={`asset_location_${index}`}
                        value={asset.location || ''}
                        onChange={(e) => updateAsset(asset, 'location', e.target.value)}
                        placeholder={t("locationPlaceholder")}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("locationHelper")}
                      </p>
                    </div>

                    {/* Photo Upload */}
                    {willId && asset.id && (
                      <div className="pt-4 border-t">
                        <AssetPhotoUpload
                          assetId={asset.id}
                          willId={willId}
                          photoPath={asset.photo_path}
                          onPhotoChange={(path) => updateAsset(asset, 'photo_path', path)}
                        />
                      </div>
                    )}

                    {/* Document Upload */}
                    {willId && asset.id && (
                      <div className="pt-4 border-t">
                        <AssetDocumentUpload
                          assetId={asset.id}
                          willId={willId}
                          documents={asset.documents || []}
                          onDocumentsChange={(docs) => updateAsset(asset, 'documents', docs)}
                        />
                      </div>
                    )}

                  </CardContent>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={addAsset} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {t('form:addAnotherAsset')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* General Beneficiary Dialog */}
      <GeneralBeneficiaryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveGeneralBeneficiary}
        editingBeneficiary={editingBeneficiary}
        willId={willId}
      />
    </div>
  );
}
