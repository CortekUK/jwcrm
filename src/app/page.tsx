"use client";

import { StickyHeader } from "@/components/landing/StickyHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { BenefitsGrid } from "@/components/landing/BenefitsGrid";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { FAQSection } from "@/components/landing/FAQSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden scroll-smooth">
      <StickyHeader />

      <main className="flex-1">
        <HeroSection />
        <BenefitsGrid />
        <HowItWorksSection />
        <SecuritySection />
        <FAQSection />
      </main>

      <LandingFooter />
    </div>
  );
}
