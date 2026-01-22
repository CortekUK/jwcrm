import { Check, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StepSaveStatus = 'saved' | 'unsaved' | 'error' | 'idle';

interface StepStatus {
  saveStatus: StepSaveStatus;
  errorCount?: number;
}

interface FormStepperProps {
  currentStep: number;
  completedSteps: number[];
  lastStepWithData?: number | null;
  onStepClick: (step: number) => void;
  stepStatuses?: Record<number, StepStatus>;
  isSaving?: boolean;
  willType?: 'general' | 'specific';
}

export function FormStepper({
  currentStep,
  completedSteps,
  lastStepWithData = null,
  onStepClick,
  stepStatuses = {},
  isSaving = false,
  willType = 'general'
}: FormStepperProps) {
  const { t } = useTranslation('form');
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';

  // Dynamic steps based on will type
  const getSteps = () => {
    const baseSteps = [
      { number: 1, label: t('personalDetails') },
      { number: 2, label: t('identityUpload') },
      { number: 3, label: t('beneficiaries') },
    ];

    if (willType === 'specific') {
      // For specific wills: Personal, Identity, Beneficiaries, Assets, Executors, Trustees, Interim, Permanent, Receipt, Letter, Review
      return [
        ...baseSteps,
        { number: 4, label: t('assets') },
        { number: 5, label: t('executors') },
        { number: 6, label: t('trustees') },
        { number: 7, label: t('interimGuardians') },
        { number: 8, label: t('permanentGuardians') },
        { number: 9, label: t('receiptAndDisinherit') },
        { number: 10, label: t('familyExclusionAndLetter') },
        { number: 11, label: t('reviewConfirm') },
      ];
    } else {
      // For general wills: Personal, Identity, Beneficiaries, Assets, Executors, Trustees, Interim, Permanent, Receipt, Letter, Review
      return [
        ...baseSteps,
        { number: 4, label: t('assets') },
        { number: 5, label: t('executors') },
        { number: 6, label: t('trustees') },
        { number: 7, label: t('interimGuardians') },
        { number: 8, label: t('permanentGuardians') },
        { number: 9, label: t('receiptAndDisinherit') },
        { number: 10, label: t('familyExclusionAndLetter') },
        { number: 11, label: t('reviewConfirm') },
      ];
    }
  };

  const STEPS = getSteps();

  const getStepTooltip = (stepNumber: number, status?: StepStatus) => {
    if (!status) return null;

    switch (status.saveStatus) {
      case 'saved':
        return t('form:saved');
      case 'unsaved':
        return t('form:unsavedChanges');
      case 'error':
        return status.errorCount 
          ? t('form:errorMissingFields', { count: status.errorCount })
          : t('form:validationError');
      default:
        return null;
    }
  };

  const getStatusIndicator = (stepNumber: number, status?: StepStatus) => {
    if (!status || status.saveStatus === 'idle') return null;

    const positionClass = isRtl ? '-top-0.5 -left-0.5' : '-top-0.5 -right-0.5';

    // Show spinner on current step if saving
    if (stepNumber === currentStep && isSaving) {
      return (
        <div className={cn(
          "absolute w-4 h-4 bg-accent rounded-full flex items-center justify-center border-2 border-background animate-scale-in",
          positionClass
        )}>
          <Loader2 className="h-2.5 w-2.5 text-accent-foreground animate-spin" strokeWidth={3} />
        </div>
      );
    }

    switch (status.saveStatus) {
      case 'saved':
        return (
          <div className={cn(
            "absolute w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-background animate-scale-in",
            positionClass
          )}>
            <CheckCircle2 className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </div>
        );
      case 'error':
        return (
          <div className={cn(
            "absolute w-4 h-4 bg-destructive rounded-full flex items-center justify-center border-2 border-background animate-scale-in",
            positionClass
          )}>
            <AlertCircle className="h-2.5 w-2.5 text-destructive-foreground" strokeWidth={3} />
          </div>
        );
      case 'unsaved':
        return (
          <div className={cn(
            "absolute w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-background animate-scale-in",
            positionClass
          )}>
            <div className="w-full h-full bg-orange-500 rounded-full animate-pulse" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="py-6 shadow-[0_2px_6px_rgba(12,85,54,0.04)] overflow-x-auto scrollbar-thin"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <ol className={cn(
          "flex items-start gap-0 min-w-max mx-auto",
          // Adjust max-width based on number of steps
          STEPS.length > 10 ? "max-w-none px-4" : "max-w-7xl"
        )}>
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.number);
            const isCurrent = currentStep === step.number;
            const isLastStepWithData = lastStepWithData === step.number;
            const isPast = step.number < currentStep;
            const isFuture = step.number > currentStep;
            const status = stepStatuses[step.number];
            const tooltipText = getStepTooltip(step.number, status);

            // Determine which steps should show green connectors
            const prevStepCompleted = completedSteps.includes(step.number - 1);
            const nextStepCompleted = completedSteps.includes(step.number + 1);

            return (
              <li
                key={step.number}
                className={cn(
                  "relative flex flex-col items-center flex-shrink-0",
                  // Make steps more compact when there are more than 10
                  STEPS.length > 10 ? "w-24" : "w-28"
                )}
              >
                {/* Connector to previous step number (visually left in LTR, right in RTL) */}
                {step.number > 1 && (
                  <div
                    className={cn(
                      "absolute top-6 h-0.5 transition-colors duration-300",
                      isRtl ? "left-1/2 right-0" : "left-0 right-1/2",
                      (isCompleted || prevStepCompleted) ? "bg-accent" : "bg-muted/50"
                    )}
                  />
                )}

                {/* Connector to next step number (visually right in LTR, left in RTL) */}
                {step.number < STEPS.length && (
                  <div
                    className={cn(
                      "absolute top-6 h-0.5 transition-colors duration-300",
                      isRtl ? "left-0 right-1/2" : "left-1/2 right-0",
                      (isCompleted || nextStepCompleted) ? "bg-accent" : "bg-muted/50"
                    )}
                  />
                )}

                {/* Circle with Tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onStepClick(step.number)}
                      disabled={!isCompleted && !isCurrent}
                      className={cn(
                        "relative w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 z-10",
                        // Completed steps OR current step: green background, clickable
                        (isCompleted || isCurrent) && "bg-accent text-accent-foreground shadow-md cursor-pointer hover:brightness-110",
                        // Not completed and not current: gray, disabled
                        !isCompleted && !isCurrent && "bg-muted/50 text-muted-foreground/50 cursor-not-allowed",
                        // Current step: add ring
                        isCurrent && "ring-4 ring-accent/20"
                      )}
                    >
                      {step.number}
                      {getStatusIndicator(step.number, status)}
                    </button>
                  </TooltipTrigger>
                  {tooltipText && (
                    <TooltipContent 
                      side="bottom" 
                      className="text-xs px-2 py-1"
                      sideOffset={8}
                    >
                      {tooltipText}
                    </TooltipContent>
                  )}
                </Tooltip>

                {/* Label */}
                <span
                  className={cn(
                    "text-center hidden sm:block w-full px-1 leading-tight mt-3 line-clamp-2",
                    // Smaller text for 11 steps
                    STEPS.length > 10 ? "text-[0.65rem]" : "text-xs",
                    isCurrent && "text-foreground font-semibold",
                    isCompleted && !isCurrent && "text-accent font-medium",
                    !isCurrent && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </TooltipProvider>
  );
}
