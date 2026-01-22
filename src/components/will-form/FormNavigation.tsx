import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";

interface FormNavigationProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isStepValid: boolean;
  isSubmitting?: boolean;
}

export function FormNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isStepValid,
  isSubmitting = false,
}: FormNavigationProps) {
  const { t } = useTranslation(['form', 'common']);
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';
  
  const showBack = currentStep > 1;
  const showNext = currentStep < totalSteps;
  const showSubmit = currentStep === totalSteps;

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mt-10 pt-6 border-t border-border/50">
      <div className="flex justify-between items-center gap-4">
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="rounded-full px-6 border-border/70 hover:border-border hover:bg-muted/50 transition-all"
          >
            <BackIcon className="w-4 h-4 mr-2" />
            {t('common:back')}
          </Button>
        ) : (
          <div />
        )}

        {showNext && (
          <Button
            type="button"
            onClick={onNext}
            disabled={!isStepValid}
            className="rounded-full px-8 bg-accent hover:bg-[#134A35] hover:shadow-[0_0_6px_rgba(198,160,59,0.35),0_4px_12px_rgba(12,85,54,0.12)] text-accent-foreground shadow-md transition-all duration-250"
          >
            {t('common:next')}
            <NextIcon className="w-4 h-4 ml-2" />
          </Button>
        )}

        {showSubmit && (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!isStepValid || isSubmitting}
            className="rounded-full px-8 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md hover:shadow-lg transition-all"
          >
            {isSubmitting ? t('form:submitting') : t('form:submitWill')}
          </Button>
        )}
      </div>
    </div>
  );
}
