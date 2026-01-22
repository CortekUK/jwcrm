import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Check, Mail } from "lucide-react";
import type { FamilyExclusion, LetterOfWishes } from "@/types/will-form";
import { StepTitle } from "./StepTitle";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { useTranslation } from "react-i18next";

interface StepFamilyExclusionAndLetterProps {
  familyExclusion: FamilyExclusion;
  onFamilyExclusionChange: (data: FamilyExclusion) => void;
  letterOfWishes: LetterOfWishes;
  onLetterOfWishesChange: (data: LetterOfWishes) => void;
  clientName: string;
  errors?: Record<string, string>;
}

export function StepFamilyExclusionAndLetter({
  familyExclusion,
  onFamilyExclusionChange,
  letterOfWishes,
  onLetterOfWishesChange,
  clientName,
  errors,
}: StepFamilyExclusionAndLetterProps) {
  const { t } = useTranslation(['form']);

  return (
    <div className="space-y-8 relative">
      {/* Section 1: Letter of Wishes */}
      <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
        <h3 className="text-[22px] font-serif font-semibold text-[#121212]">
          {t('form:letterOfWishesTitle')}
        </h3>
        <p className="text-[14px] text-[#6B6B6B] leading-[1.7]">
          {t('form:letterOfWishesDescription')}
        </p>
      </div>

      <Card className="border-t-[3px] border-t-[#0C5536] shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-[#E6E6E4] bg-white rounded-lg">
        <CardContent className="pt-7 pb-7 px-6 space-y-5">
          <div className="space-y-4">
            <h4 className="text-[15px] font-semibold text-[#121212]">
              {t('form:letterOfWishesCardTitle')}
            </h4>

            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-[14px] text-[#6B6B6B] leading-[1.7]">
                <Check className="h-5 w-5 text-[#0C5536] flex-shrink-0 mt-0.5" />
                <span>
                  {t('form:letterOfWishesPrefix')}{" "}
                  <span className="italic font-medium text-[#333333]">
                    {t('form:letterOfWishesNotLegallyBinding')}
                  </span>
                  {t('form:letterOfWishesGuidelines')}
                </span>
              </li>
              <li className="flex items-start gap-3 text-[14px] text-[#6B6B6B] leading-[1.7]">
                <Check className="h-5 w-5 text-[#0C5536] flex-shrink-0 mt-0.5" />
                <span>
                  {t('form:letterOfWishesCopies')}
                </span>
              </li>
              <li className="flex items-start gap-3 text-[14px] text-[#6B6B6B] leading-[1.7]">
                <Check className="h-5 w-5 text-[#0C5536] flex-shrink-0 mt-0.5" />
                <span>
                  {t('form:letterOfWishesUpdate')}
                </span>
              </li>
            </ul>

            <div className="bg-[#F8F8F6] border-l-4 border-[#0C5536] p-4 rounded-r">
              <p className="text-[13px] text-[#6B6B6B] italic leading-relaxed">
                {t('form:letterOfWishesInfoBox')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Acknowledgment */}
      <div className="space-y-4 pb-6 border-b border-[rgba(198,160,59,0.3)]">
        <h3 className="text-[22px] font-serif font-semibold text-[#121212]">
          {t('form:acknowledgmentTitle')}
        </h3>
      </div>

      <Card className="border-t-[3px] border-t-[#0C5536] shadow-[0_1px_4px_rgba(12,85,54,0.05)] border-[#E6E6E4] bg-white rounded-lg">
        <CardContent className="pt-7 pb-7 px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <SignaturePad
                value={familyExclusion.signature}
                onChange={(signature, date) => {
                  onFamilyExclusionChange({
                    ...familyExclusion,
                    signature,
                    signature_date: date,
                  });
                }}
                label={t('form:clientSignatureLabel')}
              />
              {familyExclusion.signature_date && (
                <p className="text-xs text-[#6B6B6B]">
                  {t('form:signedOn')} {new Date(familyExclusion.signature_date).toLocaleString()}
                </p>
              )}
              {!familyExclusion.signature && (errors?.['family_exclusion.signature'] || errors?.signature) && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2">
                  <p className="text-sm text-destructive">
                    {errors?.['family_exclusion.signature'] || errors?.signature}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label className="text-[14px] font-semibold text-[#333333]">
                {t('form:justWillsSignatureLabel')}
              </Label>
              <div className="pt-6 pb-2 border-b-2 border-dotted border-[#D9D9D6]">
                <p className="text-[15px] text-[#6B6B6B] italic">
                  {t('form:completedInternally')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Information for Client */}
      <Card className="bg-[#F8F8F6] border-[#E6E6E4]">
        <CardContent className="pt-5 pb-5 px-5">
          <div className="space-y-3 text-[13px]">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-[#0C5536] flex-shrink-0 mt-0.5" />
              <p className="text-[#333333] leading-relaxed" dangerouslySetInnerHTML={{
                __html: t('form:whitelistEmailNote').replace(
                  'info@just-wills.net',
                  '<a href="mailto:info@just-wills.net" class="text-[#0C5536] hover:underline font-medium">info@just-wills.net</a>'
                )
              }} />
            </div>
            <p className="text-[#6B6B6B] leading-relaxed pl-6">
              {t('form:returnFormNote')}
            </p>
            <p className="text-[#121212] font-medium leading-relaxed pl-6 pt-2">
              {t('form:lookForwardNote')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
