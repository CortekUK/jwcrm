"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { QuarterlyReviewForm } from "@/components/hr/reviews";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  job_role?: {
    id: string;
    name: string;
  } | null;
};

type QuarterlyReview = {
  id: string;
  employee_id: string;
  quarter: number;
  year: number;
  status: string;
  employee: Employee;
};

export default function EditQuarterlyReviewPage() {
  const { t, i18n } = useTranslation(["hr", "common"]);
  const isRtl = i18n.language === "ar";
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const reviewId = params.id as string;
  
  const [review, setReview] = useState<QuarterlyReview | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch review with employee details
  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("quarterly_reviews")
          .select(`
            id,
            employee_id,
            quarter,
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
        
        if (data.status !== "draft") {
          toast({
            variant: "destructive",
            description: t("hr:reviews.cannotEditNonDraft"),
          });
          router.push(`/hr/reviews/${reviewId}`);
          return;
        }
        
        setReview(data as QuarterlyReview);
      } catch (error) {
        console.error("Error fetching review:", error);
        toast({
          variant: "destructive",
          description: t("hr:reviews.errorLoadingReview"),
        });
        router.push("/hr/reviews");
      } finally {
        setLoading(false);
      }
    };

    if (reviewId) {
      fetchReview();
    }
  }, [reviewId, t, toast, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/hr/reviews/${reviewId}`)}
          className="text-[#6B6B6B]"
        >
          <ArrowLeft className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
        </Button>
        <div className={isRtl ? "text-right" : ""}>
          <h1 className="text-2xl font-bold text-[#222222] dark:text-gray-100">
            {t("hr:reviews.editReview")}
          </h1>
          <p className="text-[#6B6B6B] dark:text-gray-400 mt-1">
            Q{review.quarter} {review.year} - {review.employee?.full_name}
          </p>
        </div>
      </div>

      {/* Review Form */}
      <QuarterlyReviewForm
        employee={review.employee}
        reviewId={reviewId}
        initialQuarter={review.quarter}
        initialYear={review.year}
        onSuccess={() => router.push(`/hr/reviews/${reviewId}`)}
      />
    </div>
  );
}
