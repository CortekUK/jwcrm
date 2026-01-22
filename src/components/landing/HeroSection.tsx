import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-24 lg:py-32">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left column - Content */}
        <div className="animate-fade-in-up space-y-8">
          <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              {t('hero.title')}
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
            {t('hero.subtitle')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/client/auth/signup">
              <Button size="lg" className="gap-2">
                {t('hero.ctaPrimary')}
              </Button>
            </Link>
            <Link href="/client/auth">
              <Button size="lg" variant="ghost">
                {t('hero.ctaSecondary')}
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span>{t('hero.trustBadge1')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-accent" />
              <span>{t('hero.trustBadge2')}</span>
            </div>
          </div>
        </div>

        {/* Right column - Visual */}
        <div className="relative lg:h-[500px] flex items-center justify-center">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50 animate-float" />
          
          {/* Document stack illustration */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Back documents (stacked effect) */}
            <div className="absolute -rotate-6 w-64 h-80 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 backdrop-blur-sm border border-border/50 animate-float" style={{ animationDelay: '0.5s' }} />
            <div className="absolute rotate-3 w-64 h-80 rounded-2xl bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-sm border border-border/50 animate-float" style={{ animationDelay: '1s' }} />
            
            {/* Main document */}
            <div className="relative w-64 h-80 rounded-2xl bg-gradient-to-br from-card to-card/90 backdrop-blur-sm border border-border shadow-2xl p-6 animate-float">
              {/* Document lines */}
              <div className="space-y-3 mb-8">
                <div className="h-2 w-3/4 bg-gradient-to-r from-accent/30 to-primary/30 rounded-full" />
                <div className="h-2 w-full bg-gradient-to-r from-accent/20 to-primary/20 rounded-full" />
                <div className="h-2 w-5/6 bg-gradient-to-r from-accent/20 to-primary/20 rounded-full" />
                <div className="h-2 w-4/5 bg-gradient-to-r from-accent/15 to-primary/15 rounded-full" />
              </div>
              
              {/* Document icon */}
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10">
                  <FileText className="h-12 w-12 text-accent" />
                </div>
              </div>
              
              {/* More document lines */}
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-gradient-to-r from-muted to-muted/50 rounded-full" />
                <div className="h-1.5 w-5/6 bg-gradient-to-r from-muted to-muted/50 rounded-full" />
                <div className="h-1.5 w-4/5 bg-gradient-to-r from-muted to-muted/50 rounded-full" />
              </div>
            </div>
            
            {/* Floating shield badge */}
            <div className="absolute -bottom-4 -right-4 p-4 rounded-2xl bg-gradient-to-br from-accent to-primary shadow-xl animate-float" style={{ animationDelay: '0.2s' }}>
              <Shield className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
