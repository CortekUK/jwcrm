import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const bullets = ['bullet1', 'bullet2', 'bullet3', 'bullet4'];

export function SecuritySection() {
  const { t } = useTranslation('landing');

  return (
    <section className="bg-gradient-to-br from-muted/20 to-background py-20">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Icon column */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-primary/30 rounded-full blur-3xl opacity-40" />
            <div className="relative p-12 rounded-full bg-gradient-to-br from-accent/10 to-primary/10">
              <Shield className="h-32 w-32 text-accent" />
            </div>
          </div>
          
          {/* Content column */}
          <div className="space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold">
              {t('security.title')}
            </h2>
            
            <ul className="space-y-4">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-accent shrink-0 mt-0.5" />
                  <span className="text-lg">{t(`security.${bullet}`)}</span>
                </li>
              ))}
            </ul>
            
            <div className="flex gap-4 text-sm pt-4">
              <Link href="#" className="text-accent hover:underline">
                {t('security.privacyLink')}
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="#" className="text-accent hover:underline">
                {t('security.termsLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
