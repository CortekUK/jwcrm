"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { MonthlyReviewForm } from "@/components/hr/reviews";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  job_role: {
    id: string;
    name: string;
  } | null;
};

type MonthlyReview = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  employee: Employee;
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function EditMonthlyReviewPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);

  const reviewId = params.id as string;

  // Fetch review data
  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("monthly_reviews")
          .select(`
            id,
            employee_id,
            month,
            year,
            status,
            employee:employees(
              id,
              full_name,
              email,
              job_title,
              department:departments(id, name),
              job_role:job_roles(id, name)
            )
          `)
          .eq("id", reviewId)
          .single();

        if (error) throw error;

        // Check if review is editable
        if (data.status !== "draft") {
          toast({
            variant: "destructive",
            description: t("hr:reviews.cannotEditNonDraft"),
          });
          router.push(`/hr/reviews/monthly/${reviewId}`);
          return;
        }

        setReview(data as MonthlyReview);
      } catch (error) {
        console.error("Error fetching review:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.reviewNotFound"),
        });
        router.push("/hr/reviews/monthly");
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [reviewId, router, t, toast]);

  const getMonthName = (month: number) => {
    return t(`hr:month.${monthNames[month - 1].toLowerCase()}`, monthNames[month - 1]);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/hr/reviews/monthly/${reviewId}`)}
          className="text-[#6B6B6B]"
        >
          <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
        </Button>
        <div className={isRtl ? "text-right" : ""}>
          <div className={`flex items-center gap-3 mb-1 ${isRtl ? "flex-row-reverse" : ""}`}>
            <CalendarDays className="h-5 w-5 text-[hsl(var(--jw-gold-accent))]" />
            <h1 className="text-2xl font-semibold text-[hsl(var(--jw-primary-green))]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {t("hr:reviews.editReview")}
            </h1>
          </div>
          <p className="text-sm text-[#777777]">
            {getMonthName(review.month)} {review.year} - {review.employee?.full_name}
          </p>
        </div>
      </div>

      {/* Monthly Review Form */}
      <MonthlyReviewForm
        employee={review.employee}
        reviewId={review.id}
        initialMonth={review.month}
        initialYear={review.year}
        onSuccess={() => router.push(`/hr/reviews/monthly/${reviewId}`)}
      />
    </div>
  );
}
