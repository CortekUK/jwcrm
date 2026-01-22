import { ReactNode } from "react";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Lock } from "lucide-react";
import JustWillsLogo from "@/assets/justwills.png";
import { useTranslation } from "react-i18next";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FAFAFA] to-[#F3F3F3]">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <LanguageSwitcher />
      </div>
      
      <div className="w-full max-w-[440px] space-y-8 rounded-[10px] border border-[#E6E6E4] bg-white p-10 shadow-[0_6px_16px_rgba(12,85,54,0.08)] animate-scale-in">
        <div className="text-center">
          <Image
            src={JustWillsLogo}
            alt="Just Wills"
            className="h-20 w-auto mx-auto -translate-x-4 mb-2.5 animate-fade-in"
            width={200}
            height={80}
          />
        </div>
        
        {children}

        {/* Security Notice Footer */}
        <div className="text-center mt-5 pt-5 border-t border-[#E6E6E4] relative">
          {/* Gold accent line above */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[2px] bg-gradient-to-r from-transparent via-[#C6A03B] to-transparent" />
          
          <div className="flex items-center justify-center gap-2 mt-2">
            <p className="text-[12px] text-[#6B6B6B] leading-relaxed">
              {t('securityNotice')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
