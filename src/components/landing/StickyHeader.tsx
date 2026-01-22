import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function StickyHeader() {
  const { t } = useTranslation('landing');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md bg-background/95 transition-all duration-300 ${
        isScrolled ? 'shadow-md py-3' : 'py-4'
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <FileText className="h-6 w-6 text-accent" />
          <span className="text-xl font-semibold">WillPortal</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/client/auth">
            <Button>{t('hero.ctaSecondary')}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
