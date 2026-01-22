import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { textAlign } from "@/lib/rtl-utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, className, children }: PageHeaderProps) {
  const { locale } = useLanguage();
  const isRtl = locale === 'ar';

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className={cn("space-y-1 flex-1", textAlign(isRtl))}>
          <h1 className="text-[1.75rem] font-bold text-[#0C5536] leading-tight font-serif">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[1rem] text-[#4B4B4B] leading-[1.6] max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-3 sm:ml-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
