import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { STATUS_WORKFLOW, getClientStep, getClientSteps } from "@/lib/status-config";
import { useTranslation } from "react-i18next";

type WillStatus = Database["public"]["Enums"]["will_status"];

interface StatusTimelineProps {
  currentStatus: WillStatus;
  view: 'client' | 'admin';
  useClientFriendlyLabels?: boolean;
  className?: string;
}

// Get all admin steps from STATUS_WORKFLOW
const allSteps = Object.entries(STATUS_WORKFLOW)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([status, config]) => ({
    status: status as WillStatus,
    label: config.label,
    color: config.color,
    icon: config.icon,
    description: config.description,
  }));

export function StatusTimeline({ currentStatus, view, useClientFriendlyLabels = false, className }: StatusTimelineProps) {
  const { t } = useTranslation(['admin', 'portal']);

  // Helper function to map step number to translation key
  const getTimelineTranslationKey = (stepNumber: number): string => {
    switch (stepNumber) {
      case 1:
        return 'portal:timeline.inProgress';
      case 2:
        return 'portal:timeline.submittedForReview';
      case 3:
        return 'portal:timeline.underReview';
      case 4:
        return 'portal:timeline.draftReady';
      default:
        return 'portal:timeline.inProgress';
    }
  };

  // Client-friendly mode: Show simplified 4-step process
  if (view === 'client' && useClientFriendlyLabels) {
    const clientSteps = getClientSteps();
    const currentClientStep = getClientStep(currentStatus);
    const currentIndex = clientSteps.findIndex(s => s.stepNumber === currentClientStep.stepNumber);

    const getStepState = (index: number): 'completed' | 'active' | 'upcoming' => {
      if (index < currentIndex) return 'completed';
      if (index === currentIndex) return 'active';
      return 'upcoming';
    };

    return (
      <div 
        className={cn("w-full", className)}
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={clientSteps.length}
        aria-label={`Will status: ${clientSteps[currentIndex]?.label || 'Unknown'}, step ${currentIndex + 1} of ${clientSteps.length}`}
      >
        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:flex items-start justify-between gap-2">
          {clientSteps.map((step, index) => {
            const state = getStepState(index);
            const isCompleted = state === 'completed';
            const isActive = state === 'active';
            const isUpcoming = state === 'upcoming';

            return (
              <div key={step.stepNumber} className="flex items-start flex-1 last:flex-initial">
                {/* Step Node and Label */}
                <div className="flex flex-col items-center gap-2 relative">
                  {/* Circle with Step Number */}
                  <div
                    className={cn(
                      "relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 font-semibold text-lg",
                      isUpcoming && "bg-muted border-2 border-border text-muted-foreground"
                    )}
                    style={!isUpcoming ? { backgroundColor: step.color, color: 'white' } : undefined}
                    aria-label={`${step.label}: ${state}, step ${index + 1} of ${clientSteps.length}`}
                  >
                    {/* Pulsing ring for active step */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-full animate-pulse opacity-30"
                        style={{ border: `2px solid ${step.color}` }}
                        aria-hidden="true"
                      />
                    )}
                    
                    {step.stepNumber}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "text-sm text-center transition-all duration-300 max-w-[100px]",
                      isActive && "font-bold text-foreground",
                      isCompleted && "font-medium text-foreground",
                      isUpcoming && "text-muted-foreground"
                    )}
                  >
                    {t(getTimelineTranslationKey(step.stepNumber))}
                  </span>
                </div>

                {/* Connector Line */}
                {index < clientSteps.length - 1 && (
                  <div className="flex items-center pt-6 flex-1 px-2">
                    <div
                      className={cn(
                        "h-0.5 w-full transition-all duration-300",
                        isUpcoming && "border-t-2 border-dashed border-border"
                      )}
                      style={!isUpcoming ? { backgroundColor: step.color } : undefined}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: Horizontal Scrollable */}
        <div className="md:hidden overflow-x-auto snap-x snap-mandatory pb-2">
          <div className="flex items-start gap-4 min-w-max px-4">
            {clientSteps.map((step, index) => {
              const state = getStepState(index);
              const isCompleted = state === 'completed';
              const isActive = state === 'active';
              const isUpcoming = state === 'upcoming';

              return (
                <div key={step.stepNumber} className="flex items-start snap-center">
                  {/* Step Node and Label */}
                  <div className="flex flex-col items-center gap-2 relative">
                    {/* Circle with Step Number */}
                    <div
                      className={cn(
                        "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-semibold",
                        isUpcoming && "bg-muted border-2 border-border text-muted-foreground"
                      )}
                      style={!isUpcoming ? { backgroundColor: step.color, color: 'white' } : undefined}
                      aria-label={`${step.label}: ${state}, step ${index + 1} of ${clientSteps.length}`}
                    >
                      {isActive && (
                        <div 
                          className="absolute inset-0 rounded-full animate-pulse opacity-30"
                          style={{ border: `2px solid ${step.color}` }}
                          aria-hidden="true"
                        />
                      )}
                      
                      {step.stepNumber}
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        "text-xs text-center transition-all duration-300 max-w-[70px]",
                        isActive && "font-bold text-foreground",
                        isCompleted && "font-medium text-foreground",
                        isUpcoming && "text-muted-foreground"
                      )}
                    >
                      {t(getTimelineTranslationKey(step.stepNumber))}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {index < clientSteps.length - 1 && (
                    <div className="flex items-center pt-5 w-8">
                      <div
                        className={cn(
                          "h-0.5 w-full transition-all duration-300",
                          isUpcoming && "border-t-2 border-dashed border-border"
                        )}
                        style={!isUpcoming ? { backgroundColor: step.color } : undefined}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Admin mode: Show all 6 steps
  const steps = allSteps;

  const currentIndex = steps.findIndex(s => s.status === currentStatus);

  const getStepState = (index: number): 'completed' | 'active' | 'upcoming' => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div 
      className={cn("w-full", className)}
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-label={`Will status: ${steps[currentIndex]?.label || 'Unknown'}`}
    >
      {/* Desktop: Horizontal Timeline */}
      <div className="hidden md:flex items-start justify-between gap-2">
        {steps.map((step, index) => {
          const state = getStepState(index);
          const Icon = step.icon;
          const isCompleted = state === 'completed';
          const isActive = state === 'active';
          const isUpcoming = state === 'upcoming';

          return (
            <div key={step.status} className="flex items-start flex-1 last:flex-initial">
              {/* Step Node and Label */}
              <div className="flex flex-col items-center gap-2 relative">
                {/* Circle with hover effect */}
                  <div
                    className={cn(
                      "relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-default group-hover:scale-110",
                      isCompleted && "border border-[#C6A03B]",
                      isActive && "border-2 border-[#C6A03B] shadow-lg",
                      isUpcoming && "bg-white border-2 border-[#C6A03B]/30"
                    )}
                    style={!isUpcoming ? { backgroundColor: step.color } : undefined}
                    aria-label={`${step.label}: ${state}`}
                    title={step.description}
                  >
                    {/* Pulsing ring for active step */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-full animate-pulse opacity-40"
                        style={{ boxShadow: `0 0 16px ${step.color}` }}
                        aria-hidden="true"
                      />
                    )}
                    
                    <Icon 
                      className={cn(
                        "h-5 w-5 transition-colors duration-300",
                        isUpcoming ? "text-[#C6A03B]" : "text-white"
                      )}
                      aria-hidden="true"
                    />
                  </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-[13px] text-center transition-all duration-300 max-w-[100px]",
                    isActive && "font-medium text-[hsl(var(--jw-primary-green))]",
                    isCompleted && "font-normal text-[#555555]",
                    isUpcoming && "text-[#777777]"
                  )}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {t(step.status)}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex items-center pt-6 flex-1 px-2">
                  <div
                    className={cn(
                      "h-0.5 w-full transition-all duration-300",
                      isUpcoming && "border-t-2 border-dashed border-border"
                    )}
                    style={!isUpcoming ? { backgroundColor: step.color } : undefined}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Horizontal Scrollable */}
      <div className="md:hidden overflow-x-auto snap-x snap-mandatory pb-2">
        <div className="flex items-start gap-4 min-w-max px-4">
          {steps.map((step, index) => {
            const state = getStepState(index);
            const Icon = step.icon;
            const isCompleted = state === 'completed';
            const isActive = state === 'active';
            const isUpcoming = state === 'upcoming';

            return (
              <div key={step.status} className="flex items-start snap-center">
                {/* Step Node and Label */}
                <div className="flex flex-col items-center gap-2 relative">
                  {/* Circle */}
                  <div
                    className={cn(
                      "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                      isUpcoming && "bg-muted border-2 border-border"
                    )}
                    style={!isUpcoming ? { backgroundColor: step.color } : undefined}
                    aria-label={`${step.label}: ${state}`}
                  >
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-full animate-pulse opacity-30"
                        style={{ border: `2px solid ${step.color}` }}
                        aria-hidden="true"
                      />
                    )}
                    
                    <Icon 
                      className={cn(
                        "h-4 w-4 transition-colors duration-300",
                        isUpcoming ? "text-muted-foreground" : "text-white"
                      )}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "text-xs text-center transition-all duration-300 max-w-[70px]",
                      isActive && "font-bold text-foreground",
                      isCompleted && "font-medium text-foreground",
                      isUpcoming && "text-muted-foreground"
                    )}
                  >
                    {t(step.status)}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex items-center pt-5 w-8">
                    <div
                      className={cn(
                        "h-0.5 w-full transition-all duration-300",
                        isUpcoming && "border-t-2 border-dashed border-border"
                      )}
                      style={!isUpcoming ? { backgroundColor: step.color } : undefined}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
