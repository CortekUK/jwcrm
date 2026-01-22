import { useTranslation } from 'react-i18next';

const steps = ['step1', 'step2', 'step3'];

export function HowItWorksSection() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-20">
      <h2 className="text-3xl lg:text-4xl font-bold text-center mb-16">
        {t('howItWorks.title')}
      </h2>
      
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line - hidden on mobile */}
          <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 border-t-2 border-dashed border-accent/30" style={{ top: '3rem' }} />
          
          {steps.map((step, index) => (
            <div
              key={step}
              className="relative text-center animate-fade-in"
              style={{ animationDelay: `${index * 200}ms` }}
            >
              {/* Numbered badge */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-lg">
                  {index + 1}
                </div>
              </div>
              
              <h3 className="text-xl font-semibold mb-3">
                {t(`howItWorks.${step}.title`)}
              </h3>
              <p className="text-muted-foreground">
                {t(`howItWorks.${step}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
