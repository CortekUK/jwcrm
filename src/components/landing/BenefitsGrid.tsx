import { useTranslation } from 'react-i18next';
import { Shield, FileCheck, Clock, Languages } from 'lucide-react';

const benefits = [
  { key: 'secure', Icon: Shield },
  { key: 'easy', Icon: FileCheck },
  { key: 'access', Icon: Clock },
  { key: 'multilingual', Icon: Languages },
];

export function BenefitsGrid() {
  const { t } = useTranslation('landing');

  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">
          {t('benefits.title')}
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.Icon;
            return (
              <div
                key={benefit.key}
                className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-lg bg-accent/10">
                    <Icon className="h-8 w-8 text-accent" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-center mb-2">
                  {t(`benefits.${benefit.key}.title`)}
                </h3>
                <p className="text-muted-foreground text-center">
                  {t(`benefits.${benefit.key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
