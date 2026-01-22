import { cn } from "@/lib/utils";

interface StepTitleProps {
  title: string;
  className?: string;
}

/**
 * Standardized section title component for will form steps
 */
export function StepTitle({ title, className }: StepTitleProps) {
  return (
    <div className={cn("mb-6", className)}>
      <h2 className="text-[1.25rem] font-semibold text-[#0C5536] mb-2">
        {title}
      </h2>
      <div className="w-16 h-[1.5px] bg-[#C6A03B]" />
    </div>
  );
}
