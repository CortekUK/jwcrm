import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const questions = ['q1', 'q2', 'q3', 'q4', 'q5'];

export function FAQSection() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-20">
      <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">
        {t('faq.title')}
      </h2>
      
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="space-y-4">
          {questions.map((q) => (
            <AccordionItem
              key={q}
              value={q}
              className="border rounded-lg px-6 hover:border-accent/50 transition-colors"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold">{t(`faq.${q}.question`)}</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {t(`faq.${q}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
