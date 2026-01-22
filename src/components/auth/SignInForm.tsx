"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { signInSchema, SignInFormData } from "@/lib/auth-validation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardType,
  getDashboardBySlug,
  hasAccessToDashboard,
  hasInternalAccess,
  getDefaultRouteForRoles,
} from "@/config/dashboards";

interface SignInFormProps {
  dashboardType: DashboardType;
}

export function SignInForm({ dashboardType }: SignInFormProps) {
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation(["auth", "toast"]);

  const dashboardConfig = getDashboardBySlug(dashboardType);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  // Handle redirect when user is already logged in
  useEffect(() => {
    if (user && profile) {
      // For admin dashboard, allow any internal role and redirect to role-specific page
      if (dashboardType === "admin") {
        if (hasInternalAccess(profile.roles)) {
          router.push(getDefaultRouteForRoles(profile.roles));
        }
      } else if (hasAccessToDashboard(profile.roles, dashboardType)) {
        // Check if user has access to this specific dashboard
        router.push(dashboardConfig.basePath);
      }
      // If user doesn't have access, they stay on the login page
      // They'll see an error if they try to submit
    }
  }, [user, profile, router, dashboardType, dashboardConfig.basePath]);

  const onSubmit = async (data: SignInFormData) => {
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      // Check if user is deactivated
      if (authData.user?.user_metadata?.is_active === false) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: t("toast:auth.accountDeactivated"),
          description: t("toast:auth.yourAccountHasBeenDeactivated"),
        });
        setLoading(false);
        return;
      }

      // Fetch user roles to check access
      const { data: rolesData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);

      if (roleError) throw roleError;

      const userRoles = rolesData?.map((r) => r.role as UserRole) || [];

      // Check if user has access to this dashboard
      // For admin dashboard, allow any internal role (admin, hr, finance, lead_management)
      const hasAccess =
        dashboardType === "admin"
          ? hasInternalAccess(userRoles)
          : hasAccessToDashboard(userRoles, dashboardType);

      if (!hasAccess) {
        // User doesn't have the required role - sign them out and show error
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: t("toast:auth.accessDenied"),
          description: t("toast:auth.noAccessToDashboard"),
        });
        setLoading(false);
        return;
      }

      // User has access - redirect to the appropriate page based on role
      toast({
        title: t("toast:auth.signInSuccess"),
      });

      // For admin dashboard, redirect to role-specific page
      if (dashboardType === "admin") {
        router.push(getDefaultRouteForRoles(userRoles));
      } else {
        router.push(dashboardConfig.basePath);
      }
    } catch (error: any) {
      // Translate common Supabase error messages
      let errorMessage = t("toast:auth.invalidCredentials");

      if (error.message?.includes("Email not confirmed")) {
        errorMessage = t("toast:auth.emailNotConfirmed");
      } else if (error.message?.includes("Invalid login credentials")) {
        errorMessage = t("toast:auth.invalidCredentials");
      }

      toast({
        variant: "destructive",
        title: t("toast:auth.signInError"),
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center mb-[30px]">
        <h1 className="text-[22px] font-serif font-semibold tracking-tight text-[#121212] mb-2">
          {t("welcomeBack")}
        </h1>
        <p className="text-[14px] text-[#555555]">{t("signInSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

        <div className="text-right rtl:text-left">
          <Link
            href={`${dashboardConfig.authPath}/reset`}
            className="text-[12px] text-[#0C5536] hover:underline"
          >
            {t("forgotPassword")}
          </Link>
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
              {t("signingIn")}
            </>
          ) : (
            t("signInButton")
          )}
        </Button>
      </form>

      {/* Only show signup link for client dashboard */}
      {dashboardType === "client" && (
        <div className="text-center">
          <p className="text-[13px] text-[#555555]">
            {t("noAccount")}{" "}
            <Link
              href={`${dashboardConfig.authPath}/signup`}
              className="text-[#0C5536] hover:underline font-medium"
            >
              {t("signUp")}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
