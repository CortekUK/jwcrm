"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardAuthLayout } from "@/components/auth/DashboardAuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { signUpSchema, SignUpFormData } from "@/lib/auth-validation";
import { Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ClientAuthSignup() {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const { user, profile } = useAuth();
  const { locale } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("auth");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  useEffect(() => {
    if (user && profile) {
      router.push("/client");
    }
  }, [user, profile, router]);

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (error) throw error;

      // Update profile locale after signup
      if (authData.user) {
        await supabase
          .from("profiles")
          .update({ locale })
          .eq("user_id", authData.user.id);
      }

      // Show success state
      setRegisteredEmail(data.email);
      setIsSuccess(true);

      // Start resend cooldown (60 seconds)
      setResendCooldown(60);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("toast:auth.signUpError"),
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend verification email
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: registeredEmail,
      });

      if (error) throw error;

      toast({
        title: t("toast:auth.verificationResent"),
      });

      // Reset cooldown
      setResendCooldown(60);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("toast:error"),
        description: error.message,
      });
    }
  };

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle change email (go back to form)
  const handleChangeEmail = () => {
    setIsSuccess(false);
    setRegisteredEmail("");
    reset();
  };

  // Success state - Check Your Inbox
  if (isSuccess) {
    return (
      <DashboardAuthLayout dashboardType="client">
        <div className="space-y-6 text-center animate-fade-in">
          {/* Envelope Icon with Float Animation */}
          <div className="flex justify-center">
            <div className="w-[70px] h-[70px] rounded-full bg-[rgba(12,85,54,0.1)] flex items-center justify-center animate-float">
              <Mail className="h-8 w-8 text-[#0C5536]" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-[24px] font-serif font-semibold tracking-tight text-[#121212]">
              {t("checkYourInbox")}
            </h1>
            <p className="text-[14px] text-[#555555] leading-[1.6] max-w-[90%] mx-auto">
              {t("verificationEmailSent")}{" "}
              <span className="font-medium text-[#0C5536]">
                {registeredEmail}
              </span>
              .<br />
              {t("clickLinkToVerify")}
            </p>
          </div>

          {/* Primary CTA - Open Email App */}
          <a href={`mailto:${registeredEmail}`} className="block">
            <Button
              className={cn(
                "w-[80%] h-[46px] bg-[#0C5536] text-white rounded-md mx-auto",
                "font-semibold text-[15px]",
                "hover:bg-[#09422A] hover:shadow-[0_0_6px_rgba(198,160,59,0.45)]",
                "focus:ring-2 focus:ring-[#C6A03B] focus:ring-offset-2",
                "transition-all duration-200 transform hover:-translate-y-0.5"
              )}
            >
              <Mail className="mr-2 h-4 w-4" />
              {t("openEmailApp")}
            </Button>
          </a>

          {/* Secondary Actions */}
          <div className="space-y-3 pt-2">
            <div>
              <button
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                className={cn(
                  "text-[13px] font-medium",
                  resendCooldown > 0
                    ? "text-[#999999] cursor-not-allowed"
                    : "text-[#0C5536] hover:underline"
                )}
              >
                {resendCooldown > 0
                  ? `${t("resendAvailableIn")} ${resendCooldown}s`
                  : t("resendVerificationLink")}
              </button>
            </div>

            <div>
              <button
                onClick={handleChangeEmail}
                className="text-[13px] text-[#0C5536] hover:underline font-medium"
              >
                {t("changeEmailAddress")}
              </button>
            </div>
          </div>

          {/* Timing & Expectation Text */}
          <div className="pt-2">
            <p className="text-[12px] text-[#777777] leading-[1.4] max-w-sm mx-auto">
              {t("emailArrivalNote")}
            </p>
          </div>
        </div>
      </DashboardAuthLayout>
    );
  }

  return (
    <DashboardAuthLayout dashboardType="client">
      <div className="space-y-6">
        <div className="space-y-2 text-center mb-[30px]">
          <h1 className="text-[22px] font-serif font-semibold tracking-tight text-[#121212] mb-2">
            {t("portal:createYourAccount")}
          </h1>
          <p className="text-[14px] text-[#555555]">
            {t("portal:securelyRegisterSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="fullName"
              className="text-[13px] font-semibold text-[#333333]"
            >
              {t("fullName")}
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder={t("fullNamePlaceholder")}
              className={cn(
                "h-[44px] border rounded-md px-[14px] placeholder:text-[#A0A0A0]",
                errors.fullName ? "border-[#C0392B]" : "border-[#E6E6E4]",
                "focus:border-[#C6A03B] focus:ring-2 focus:ring-[rgba(198,160,59,0.35)]",
                "transition-all duration-200"
              )}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p
                className="text-[12px] text-[#C0392B] mt-1"
                role="alert"
                aria-live="polite"
              >
                {t(errors.fullName.message as string)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-[13px] font-semibold text-[#333333]"
            >
              {t("email")}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              className={cn(
                "h-[44px] border rounded-md px-[14px] placeholder:text-[#A0A0A0]",
                errors.email ? "border-[#C0392B]" : "border-[#E6E6E4]",
                "focus:border-[#C6A03B] focus:ring-2 focus:ring-[rgba(198,160,59,0.35)]",
                "transition-all duration-200"
              )}
              {...register("email")}
            />
            {errors.email && (
              <p
                className="text-[12px] text-[#C0392B] mt-1"
                role="alert"
                aria-live="polite"
              >
                {t(errors.email.message as string)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[13px] font-semibold text-[#333333]"
            >
              {t("password")}
            </Label>
            <PasswordInput
              id="password"
              placeholder={t("passwordPlaceholder")}
              error={!!errors.password}
              {...register("password")}
            />
            <p className="text-[12px] text-[#888888] mt-1 flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-[#C6A03B]" />
              At least 8 characters
            </p>
            {errors.password && (
              <p
                className="text-[12px] text-[#C0392B] mt-1"
                role="alert"
                aria-live="polite"
              >
                {t(errors.password.message as string)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-[13px] font-semibold text-[#333333]"
            >
              {t("confirmPassword")}
            </Label>
            <PasswordInput
              id="confirmPassword"
              placeholder={t("confirmPasswordPlaceholder")}
              error={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p
                className="text-[12px] text-[#C0392B] mt-1"
                role="alert"
                aria-live="polite"
              >
                {t(errors.confirmPassword.message as string)}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full h-[46px] bg-[#0C5536] text-white rounded-md",
              "font-semibold text-[15px]",
              "hover:bg-[#09422A] hover:shadow-[0_0_6px_rgba(198,160,59,0.45)]",
              "focus:ring-2 focus:ring-[#C6A03B] focus:ring-offset-2",
              "disabled:bg-[#94B2A2] disabled:text-white/60 disabled:cursor-not-allowed",
              "transition-all duration-200 transform hover:-translate-y-0.5"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              t("signUpButton")
            )}
          </Button>
        </form>

        <div className="text-center mt-5">
          <span className="text-[13px] text-[#555555]">
            {t("alreadyHaveAccount")}{" "}
          </span>
          <Link
            href="/client/auth"
            className="text-[13px] text-[#0C5536] hover:text-[#C6A03B] font-medium transition-colors duration-200 relative group"
          >
            {t("signInLink")}
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-[#C6A03B] group-hover:w-full transition-all duration-300" />
          </Link>
        </div>
      </div>
    </DashboardAuthLayout>
  );
}
