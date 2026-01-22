import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function LandingFooter() {
  const { t } = useTranslation('landing');

  return (
    <footer className="border-t bg-muted/20 py-12">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Product Column */}
          <div>
            <h3 className="font-semibold text-lg mb-4">{t('footer.product')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                  {t('footer.features')}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                  {t('footer.pricing')}
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Company Column */}
          <div>
            <h3 className="font-semibold text-lg mb-4">{t('footer.company')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                  {t('footer.about')}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Legal Column */}
          <div>
            <h3 className="font-semibold text-lg mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                  {t('footer.terms')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {t('footer.copyright')}
          </p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
