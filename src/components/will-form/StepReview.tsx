import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Pencil, Lock, ScrollText, AlertCircle } from "lucide-react";
import type { Answers } from "@/types/will-form";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { StepTitle } from "./StepTitle";

interface StepReviewProps {
  data: Answers;
  confirmations: Answers['confirmations'];
  onConfirmationsChange: (confirmations: Answers['confirmations']) => void;
  pdfLanguage: 'english' | 'arabic';
  onPdfLanguageChange: (language: 'english' | 'arabic') => void;
  onEditStep?: (step: number) => void;
  errors?: Record<string, string>;
}

export function StepReview({ data, confirmations, onConfirmationsChange, pdfLanguage, onPdfLanguageChange, onEditStep, errors = {} }: StepReviewProps) {
  const { t } = useTranslation(['form']);

  // Calculate step offset based on will type
  const stepOffset = data.will_type === 'specific' ? 1 : 0;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-5 relative">
      <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
        <StepTitle title={t('form:reviewYourWillTitle')} />
        <p className="text-[14px] text-[#333333] leading-[1.7]">
          {t('form:reviewYourWillSubtitle')}
        </p>
      </div>

      {/* Personal Details */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:personalDetailsTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(1)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {t('form:editButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-4">
          <ReviewField label={t('form:fullNameReview')} value={data.personal.full_name} />
          <ReviewField label={t('form:contactNumberReview')} value={data.personal.contact_number} />
          <ReviewField label={t('form:addressReview')} value={data.personal.address} />
          <ReviewField label={t('form:emailAddressReview')} value={data.personal.email} />
          <ReviewField label={t('form:dateReview')} value={formatDate(data.personal.date)} />
          <ReviewField
            label={t('form:assetsCountryReview')}
            value={data.personal.assets_country.length > 0
              ? data.personal.assets_country.join(', ')
              : t('form:notSpecified')
            }
          />
          <ReviewField
            label={t('form:preferredContactMethodsReview')}
            value={data.personal.preferred_contact_methods.join(', ')}
          />
          <ReviewField
            label={t('form:maritalStatusReview')}
            value={data.personal.marital_status.charAt(0).toUpperCase() + data.personal.marital_status.slice(1)}
          />
          <ReviewField label={t('form:religionReview')} value={data.personal.religion} />
        </CardContent>
      </Card>

      {/* Beneficiaries */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:beneficiariesTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(3)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {t('form:editButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-6">
          {[1, 2, 3, 4, 5].map(level => {
            const levelBeneficiaries = data.beneficiaries.filter(b => b.level === level);
            if (levelBeneficiaries.length === 0) return null;

              return (
              <div key={level}>
                {level > 1 && <Separator className="bg-[#E6E6E4] my-4" />}
                <div className="space-y-4">
                  <h4 className="font-semibold text-[15px] text-[#0C5536]">
                    {t('form:levelBeneficiary', { level })}
                    {level === 1 && <span className="text-sm font-normal text-[#6B6B6B] ml-2">{t('form:primaryLabel')}</span>}
                    {level > 1 && <span className="text-sm font-normal text-[#6B6B6B] ml-2">{t('form:contingentLabel')}</span>}
                  </h4>

                  {levelBeneficiaries.map((beneficiary, idx) => (
                    <div key={idx}>
                      {idx > 0 && <Separator className="bg-[#E6E6E4] my-3" />}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{beneficiary.name}</span>
                          {beneficiary.percentage > 0 && (
                            <Badge variant="outline" className="border-[#0C5536] text-[#0C5536] text-[12px]">
                              {beneficiary.percentage}%
                            </Badge>
                          )}
                        </div>
                        <ReviewField label={t('form:relation')} value={beneficiary.relationship} small />
                        {beneficiary.comments && (
                          <ReviewField label={t('form:comments')} value={beneficiary.comments} small />
                        )}
                        {beneficiary.identity_docs && beneficiary.identity_docs.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="flex items-center gap-1 text-[#0C5536]">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6m-9 1V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                              </svg>
                              <span className="text-[12px] font-medium">
                                {t('form:documentsUploaded', { count: beneficiary.identity_docs.length })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {data.beneficiaries.length === 0 && (
            <p className="text-[14px] text-[#6B6B6B] italic">{t('form:noBeneficiariesAtThisStage')}</p>
          )}
        </CardContent>
      </Card>

      {/* Assets - Show for both will types */}
      {data.will_type && (
        <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:assetsTitle')}</CardTitle>
                <Badge variant="secondary" className="text-xs capitalize">
                  {data.will_type === 'general' ? t('form:generalWillBadge') : t('form:specificWillBadge')}
                </Badge>
              </div>
              {onEditStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditStep(4)}
                  className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  {t('form:editButton')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-6 px-6 space-y-6">
            {data.will_type === 'general' ? (
              <div className="space-y-3">
                <p className="text-[14px] text-[#555555]">
                  {t('form:everythingLeftToBeneficiaries')}
                </p>
                {data.main_beneficiary_ids && data.main_beneficiary_ids.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-[#121212]">{t('form:mainBeneficiariesTitle')}</p>
                    <ul className="list-disc list-inside space-y-1">
                      {data.main_beneficiary_ids.map((beneficiaryId) => {
                        const beneficiary = data.beneficiaries.find(b => b.name === beneficiaryId);
                        return beneficiary ? (
                          <li key={beneficiaryId} className="text-[14px] text-[#555555]">
                            {beneficiary.name} ({beneficiary.percentage}% {t('form:ofEstate')})
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              data.assets && data.assets.length > 0 ? (
                data.assets.map((asset, index) => (
                <div key={asset.id || index}>
                  {index > 0 && <Separator className="bg-[#E6E6E4] my-4" />}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-[15px] text-[#0C5536]">
                        {asset.title || `Asset ${index + 1}`}
                      </h4>
                      <Badge variant="outline" className="border-[#0C5536] text-[#0C5536] text-[12px] capitalize">
                        {asset.category}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <ReviewField label={t('form:descriptionLabel')} value={asset.description} small />
                      {asset.location && (
                        <ReviewField label={t('form:location')} value={asset.location} small />
                      )}
                      {asset.estimated_value && (
                        <ReviewField
                          label={t('form:estimatedValue')}
                          value={`AED ${asset.estimated_value.toLocaleString()}`}
                          small
                        />
                      )}
                      {asset.beneficiary_name && (
                        <ReviewField label={t('form:linkedBeneficiary')} value={asset.beneficiary_name} small />
                      )}
                      {asset.photo_path && (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex items-center gap-1 text-[#0C5536]">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[12px] font-medium">{t('form:photoUploaded')}</span>
                          </div>
                        </div>
                      )}
                      {asset.documents && asset.documents.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex items-center gap-1 text-[#0C5536]">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6m-9 1V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-[12px] font-medium">
                              {t('form:documentsUploaded', { count: asset.documents.length })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
              ) : (
                <p className="text-[14px] text-[#6B6B6B] italic">{t('form:noAssetsAddedYet')}</p>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Executors */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:executorsReviewTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(4 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {t('form:editButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-6">
          {[1, 2, 3].map(level => {
            const executor = data.executors.find(e => e.level === level);
            if (!executor) return null;

            return (
              <div key={level}>
                {level > 1 && <Separator className="bg-[#E6E6E4] my-4" />}
                <div className="space-y-3">
                  <h4 className="font-semibold text-[15px] text-[#0C5536]">
                    {t('form:executorLevel', { level })}
                  </h4>
                  <div className="space-y-2">
                    <ReviewField label={t('form:nameLabel')} value={executor.name} small />
                    <ReviewField label={t('form:relation')} value={executor.relation} small />
                    <ReviewField label={t('form:email')} value={executor.email} small />
                    <ReviewField label={t('form:contactNumberContactLabel')} value={executor.contact_number} small />
                  </div>
                </div>
              </div>
            );
          })}

          {data.executors.length === 0 && (
            <p className="text-[14px] text-[#6B6B6B] italic">{t('form:noExecutorsAppointed')}</p>
          )}

          {data.executor_permission_to_contact && (
            <>
              <Separator className="bg-[#E6E6E4] my-4" />
              <div className="text-[13px] text-[#6B6B6B]">
                {t('form:permissionGrantedExecutors')}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trustees */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:trusteesFinancialGuardians')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(5 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {t('form:editButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-6">
          {data.skip_trustees ? (
            <p className="text-[14px] text-[#6B6B6B] italic">
              {t('form:noTrusteesAppointed')}
            </p>
          ) : data.trustees.length === 0 ? (
            <p className="text-[14px] text-[#6B6B6B] italic">
              {t('form:noTrusteesAppointed')}
            </p>
          ) : (
            <>
              {[1, 2, 3].map(level => {
                const trustee = data.trustees.find(t => t.level === level);
                if (!trustee) return null;

                const levelLabel =
                  level === 1 ? t('form:primaryLabel') :
                  level === 2 ? t('form:contingentLabel') :
                  t('form:contingentLabel');

                return (
                  <div key={level}>
                    {level > 1 && <Separator className="bg-[#E6E6E4] my-4" />}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-[15px] text-[#0C5536]">
                        {t('form:trusteeLevel', { level, label: levelLabel })}
                      </h4>
                      <div className="space-y-2">
                        <ReviewField label={t('form:nameLabel')} value={trustee.name} small />
                        <ReviewField label={t('form:relation')} value={trustee.relation} small />
                        <ReviewField label={t('form:email')} value={trustee.email} small />
                        <ReviewField label={t('form:contactNumberContactLabel')} value={trustee.contact_number} small />
                      </div>
                    </div>
                  </div>
                );
              })}

              {data.trustee_permission_to_contact && (
                <>
                  <Separator className="bg-[#E6E6E4] my-4" />
                  <div className="text-[13px] text-[#6B6B6B]">
                    {t('form:permissionGrantedTrustees')}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Interim / Temporary Guardians */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:interimTemporaryGuardiansTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(6 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-6">
          {data.interim_guardians.length === 0 ? (
            <p className="text-[14px] text-[#6B6B6B] italic">{t('form:noInterimGuardiansAtThisStage')}</p>
          ) : (
            <>
              {[1, 2, 3].map(level => {
                const guardian = data.interim_guardians.find(g => g.level === level);
                if (!guardian) return null;

                const levelLabel =
                  level === 1 ? t('form:primaryLabel') :
                  level === 2 ? t('form:backup1Label') :
                  t('form:backup2Label');

                return (
                  <div key={level}>
                    {level > 1 && <Separator className="bg-[#E6E6E4] my-4" />}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-[15px] text-[#0C5536]">
                        {t('form:levelGuardian', { level, label: levelLabel })}
                      </h4>
                      <div className="space-y-2">
                        <ReviewField label={t('form:nameLabel')} value={guardian.name} small />
                        <ReviewField label={t('form:relation')} value={guardian.relation} small />
                        <ReviewField label={t('form:email')} value={guardian.email} small />
                        <ReviewField label={t('form:contactNumberContactLabel')} value={guardian.contact_number} small />
                      </div>
                    </div>
                  </div>
                );
              })}

              {data.interim_guardian_permission_to_contact && (
                <>
                  <Separator className="bg-[#E6E6E4] my-4" />
                  <div className="text-[13px] text-[#6B6B6B]">
                    {t('form:permissionGrantedInterimGuardians')}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Permanent Guardians */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:permanentGuardians')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(7 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-6">
          {data.skip_permanent_guardians ? (
            <p className="text-[14px] text-[#6B6B6B] italic">
              {t('form:noPermanentGuardiansAppointed')}
            </p>
          ) : data.permanent_guardians.length === 0 ? (
            <p className="text-[14px] text-[#6B6B6B] italic">
              {t('form:noPermanentGuardiansAtThisStage')}
            </p>
          ) : (
            <>
              {[1, 2, 3].map(level => {
                const guardian = data.permanent_guardians.find(g => g.level === level);
                if (!guardian) return null;

                return (
                  <div key={level}>
                    {level > 1 && <Separator className="bg-[#E6E6E4] my-4" />}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-[15px] text-[#0C5536]">
                        {t('form:level')} {level}
                      </h4>
                      <div className="space-y-2">
                        <ReviewField label={t('form:nameLabel')} value={guardian.name} small />
                        <ReviewField label={t('form:relation')} value={guardian.relation} small />
                        <ReviewField label={t('form:email')} value={guardian.email} small />
                        <ReviewField label={t('form:contactNumberContactLabel')} value={guardian.contact_number} small />
                      </div>
                    </div>
                  </div>
                );
              })}

              {data.permanent_guardian_permission_to_contact && (
                <>
                  <Separator className="bg-[#E6E6E4] my-4" />
                  <div className="text-[13px] text-[#6B6B6B]">
                    {t('form:permissionGrantedPermanentGuardians')}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Receipt of Will & Disinherit */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:receiptAndDisinheritTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(8 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-6">
          {/* Family Exclusion subsection */}
          <div>
            <h4 className="font-semibold text-[15px] text-[#0C5536] mb-3">
              {t('form:familyExclusionTitle')}
            </h4>
            <div className="space-y-2">
              <ReviewField
                label={t('form:excludingFamilyMembers')}
                value={data.family_exclusion?.is_excluding ? t('form:yes') : t('form:no')}
                small
              />
              {data.family_exclusion?.is_excluding && data.family_exclusion?.details && (
                <ReviewField
                  label={t('form:details')}
                  value={data.family_exclusion.details}
                  small
                />
              )}
            </div>
          </div>

          <Separator className="bg-[#E6E6E4]" />

          {/* Receipt of Will subsection */}
          <div>
            <h4 className="font-semibold text-[15px] text-[#0C5536] mb-3">
              {t('form:receiptOfWillTitle')}
            </h4>
            {data.no_receipt_persons ? (
              <p className="text-[14px] text-[#6B6B6B] italic">
                {t('form:noInformationProvided')}
              </p>
            ) : data.receipt_of_will.length === 0 ? (
              <p className="text-[14px] text-[#6B6B6B] italic">
                {t('form:noInformationProvided')}
              </p>
            ) : (
              <div className="space-y-3">
                {data.receipt_of_will.map((person, idx) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="bg-[#E6E6E4] my-3" />}
                    <div className="space-y-2">
                      <ReviewField label={t('form:nameLabel')} value={person.name} small />
                      <ReviewField label={t('form:relation')} value={person.relation} small />
                      {person.passport_number && (
                        <ReviewField label={t('form:passportNumberReview')} value={person.passport_number} small />
                      )}
                      <ReviewField label={t('form:contactNumberContactLabel')} value={person.contact_number} small />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="bg-[#E6E6E4]" />

          {/* Disinherit subsection */}
          <div>
            <h4 className="font-semibold text-[15px] text-[#0C5536] mb-3">
              {t('form:disinheritTitle')}
            </h4>
            {data.no_disinherit_persons ? (
              <p className="text-[14px] text-[#6B6B6B] italic">
                {t('form:noIndividualsDisinherited')}
              </p>
            ) : data.disinherit.length === 0 ? (
              <p className="text-[14px] text-[#6B6B6B] italic">
                {t('form:noIndividualsDisinherited')}
              </p>
            ) : (
              <div className="space-y-3">
                {data.disinherit.map((person, idx) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="bg-[#E6E6E4] my-3" />}
                    <div className="space-y-2">
                      <ReviewField label={t('form:nameLabel')} value={person.name} small />
                      <ReviewField label={t('form:relation')} value={person.relation} small />
                      {person.passport_number && (
                        <ReviewField label={t('form:passportNumberReview')} value={person.passport_number} small />
                      )}
                      {person.contact_number && (
                        <ReviewField label={t('form:contactNumberContactLabel')} value={person.contact_number} small />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Letter of Wishes */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:letterOfWishesTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(9 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {t('form:editButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6">
          <p className="text-[13px] text-[#6B6B6B]">
            {t('form:letterOfWishesAcknowledged')}
          </p>
        </CardContent>
      </Card>

      {/* Identity Documents */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#121212]">{t('form:identityDocumentsTitle')}</CardTitle>
            {onEditStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(10 + stepOffset)}
                className="text-[#0C5536] hover:text-white hover:underline h-auto px-2 py-1 text-[13px] flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {t('form:editButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-3">
          <ReviewField
            label={t('form:passport')}
            value={data.identity.passport_metadata?.name || data.identity.passport_file?.name || t('form:notUploaded')}
          />
          {data.identity.passport_metadata && (
            <div className="text-[12px] text-[#6B6B6B] ml-20">
              {formatFileSize(data.identity.passport_metadata.size)} • {t('form:uploadedOn', { date: formatDate(data.identity.passport_metadata.uploaded_at) })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Language Preference */}
      <Card className="border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)]">
        <CardHeader className="pb-4 border-b border-[rgba(198,160,59,0.3)]">
          <CardTitle className="text-[15px] font-semibold text-[#121212]">
            {t('form:pdfLanguagePreference')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6">
          <p className="text-[14px] text-[#333333] mb-6">
            {t('form:pdfLanguageDescription')}
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="pdf-english"
                checked={pdfLanguage === 'english'}
                onCheckedChange={() => onPdfLanguageChange('english')}
                className="rounded-sm data-[state=checked]:bg-[#0C5536] data-[state=checked]:border-[#0C5536]"
              />
              <Label
                htmlFor="pdf-english"
                className="text-[14px] text-[#333333] cursor-pointer font-medium"
              >
                {t('form:pdfEnglish')}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="pdf-arabic"
                checked={pdfLanguage === 'arabic'}
                onCheckedChange={() => onPdfLanguageChange('arabic')}
                className="rounded-sm data-[state=checked]:bg-[#0C5536] data-[state=checked]:border-[#0C5536]"
              />
              <Label
                htmlFor="pdf-arabic"
                className="text-[14px] text-[#333333] cursor-pointer font-medium"
              >
                {t('form:pdfArabic')}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmations */}
      <Card className={cn(
        "border-[#E6E6E4] bg-white rounded-lg shadow-[0_1px_4px_rgba(12,85,54,0.05)] mt-8",
        (errors.reviewed || errors.accuracy_confirmed) && "border-destructive"
      )}>
        <CardHeader className="pb-4 border-b border-[rgba(198,160,59,0.3)]">
          <CardTitle className="text-[20px] font-serif font-semibold text-[#121212]">
            {t('form:finalConfirmation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 space-y-5">
          <div className="flex items-start space-x-3 gap-3">
            <Checkbox
              id="reviewed"
              checked={confirmations.reviewed}
              onCheckedChange={(checked) =>
                onConfirmationsChange({ ...confirmations, reviewed: checked === true })
              }
              className="mt-0.5 rounded-sm data-[state=checked]:bg-[#0C5536] data-[state=checked]:border-[#0C5536]"
            />
            <div className="space-y-1 flex-1">
              <Label
                htmlFor="reviewed"
                className="text-[14px] text-[#333333] cursor-pointer leading-relaxed"
              >
                {t('form:confirmCompleteAccurate')}
              </Label>
              {errors.reviewed && (
                <p className="text-destructive text-[13px] mt-2">{errors.reviewed}</p>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-3 gap-3">
            <Checkbox
              id="accuracy_confirmed"
              checked={confirmations.accuracy_confirmed}
              onCheckedChange={(checked) =>
                onConfirmationsChange({ ...confirmations, accuracy_confirmed: checked === true })
              }
              className="mt-0.5 rounded-sm data-[state=checked]:bg-[#0C5536] data-[state=checked]:border-[#0C5536]"
            />
            <div className="space-y-1 flex-1">
              <Label
                htmlFor="accuracy_confirmed"
                className="text-[14px] text-[#333333] cursor-pointer leading-relaxed"
              >
                {t('form:confirmUsedForDraft')}
              </Label>
              {errors.accuracy_confirmed && (
                <p className="text-destructive text-[13px] mt-2">{errors.accuracy_confirmed}</p>
              )}
            </div>
          </div>

          {/* Security Reassurance */}
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-[#E6E6E4] mt-6">
            <Lock className="h-4 w-4 text-[#6B6B6B]" />
            <p className="text-[12px] text-[#6B6B6B] text-center leading-relaxed">
              {t('form:securityTransmission')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewField({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-2 border-b border-[#FBFBFB] last:border-0">
      <span className={cn(
        "font-medium uppercase tracking-[0.3px]",
        small ? "text-[13px]" : "text-[13px]",
        "text-[#6B6B6B]"
      )}>
        {label}
      </span>
      <span className={cn(
        small ? "text-[13px]" : "text-[14px]",
        "text-[#121212]"
      )}>
        {value || t('form:noInformationProvided')}
      </span>
    </div>
  );
}
