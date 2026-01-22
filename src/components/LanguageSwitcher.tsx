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

export function LanguageSwitcher() {
  const { t } = useTranslation('common');
  const { locale, changeLanguage, isLoading } = useLanguage();

  return (
    <Select
      value={locale}
      onValueChange={(value) => changeLanguage(value as 'en' | 'ar')}
      disabled={isLoading}
    >
      <SelectTrigger className="w-[140px]">
        <Languages className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{t('english')}</SelectItem>
        <SelectItem value="ar">{t('arabic')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
