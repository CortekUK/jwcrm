import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  /** Compact mode - show only icon */
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({ compact = false, className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common');
  const { locale, changeLanguage, isLoading } = useLanguage();
  const isRtl = i18n.language === 'ar';

  return (
    <Select
      value={locale}
      onValueChange={(value) => changeLanguage(value as 'en' | 'ar')}
      disabled={isLoading}
    >
      <SelectTrigger 
        className={cn(
          compact 
            ? "w-auto p-2 justify-center bg-sidebar-accent/20 border-sidebar-border hover:bg-sidebar-accent/30" 
            : "w-[140px]",
          className
        )}
      >
        <Languages className={cn("shrink-0", compact ? "h-5 w-5" : "h-4 w-4", !compact && (isRtl ? "ml-2" : "mr-2"))} />
        {!compact && <SelectValue />}
      </SelectTrigger>
      <SelectContent className="bg-sidebar border-sidebar-border min-w-[140px]">
        <SelectItem 
          value="en" 
          className="text-sidebar-foreground hover:bg-sidebar-accent focus:bg-sidebar-accent focus:text-sidebar-foreground"
        >
          {t('english')}
        </SelectItem>
        <SelectItem 
          value="ar"
          className="text-sidebar-foreground hover:bg-sidebar-accent focus:bg-sidebar-accent focus:text-sidebar-foreground"
        >
          {t('arabic')}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
