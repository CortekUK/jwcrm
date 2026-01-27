/**
 * Utility function to aggregate monthly reviews into quarterly review data
 * This helps HR create quarterly reviews from monthly check-ins
 */

import { supabase } from "@/integrations/supabase/client";

type MonthlyReview = {
  id: string;
  month: number;
  year: number;
  status: "draft" | "submitted" | "approved" | "complete";
  overall_kpi_score: number | null;
  performance_summary: string | null;
  achievements: string | null;
  challenges: string | null;
  goals_progress: string | null;
  manager_notes: string | null;
};

export type QuarterlyReviewDraft = {
  overall_kpi_score: number | null;
  performance_summary: string;
  strengths: string;
  areas_for_improvement: string;
  goals_next_quarter: string;
  manager_comments: string;
  monthly_reviews: MonthlyReview[];
  aggregation_metadata: {
    months_included: number[];
    total_months: number;
    complete_months: number;
    average_kpi_score: number | null;
    score_trend: "improving" | "declining" | "stable" | "insufficient_data";
  };
};

/**
 * Get the months that belong to a specific quarter
 */
function getQuarterMonths(quarter: number): number[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2];
}

/**
 * Calculate the trend from monthly scores
 */
function calculateScoreTrend(scores: (number | null)[]): "improving" | "declining" | "stable" | "insufficient_data" {
  const validScores = scores.filter((s): s is number => s !== null);
  
  if (validScores.length < 2) {
    return "insufficient_data";
  }

  // Calculate simple trend by comparing first half to second half
  const midpoint = Math.floor(validScores.length / 2);
  const firstHalf = validScores.slice(0, midpoint);
  const secondHalf = validScores.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const difference = secondAvg - firstAvg;
  const threshold = 3; // 3% threshold for determining trend

  if (difference > threshold) return "improving";
  if (difference < -threshold) return "declining";
  return "stable";
}

/**
 * Get month name from month number
 */
function getMonthName(month: number): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return monthNames[month - 1] || "";
}

/**
 * Aggregate monthly reviews into a quarterly review draft
 * 
 * @param employeeId - The employee's UUID
 * @param quarter - The quarter (1-4)
 * @param year - The year
 * @returns A draft quarterly review with aggregated content from monthly reviews
 */
export async function aggregateMonthlyToQuarterly(
  employeeId: string,
  quarter: number,
  year: number
): Promise<QuarterlyReviewDraft> {
  // Calculate the months in this quarter
  const quarterMonths = getQuarterMonths(quarter);

  // Fetch monthly reviews for this quarter
  const { data: monthlyReviews, error } = await supabase
    .from("monthly_reviews")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .in("month", quarterMonths)
    .order("month", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch monthly reviews: ${error.message}`);
  }

  const reviews = (monthlyReviews || []) as MonthlyReview[];
  const scores = reviews.map(r => r.overall_kpi_score);
  const validScores = scores.filter((s): s is number => s !== null);
  const completeReviews = reviews.filter(r => r.status === "complete" || r.status === "approved");

  // Calculate average KPI score
  const averageScore = validScores.length > 0
    ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 100) / 100
    : null;

  // Aggregate performance summaries
  const performanceSummaries = reviews
    .filter(r => r.performance_summary)
    .map(r => `**${getMonthName(r.month)}**: ${r.performance_summary}`);
  
  const aggregatedSummary = performanceSummaries.length > 0
    ? `Quarterly Performance Summary (Q${quarter} ${year}):\n\n${performanceSummaries.join("\n\n")}`
    : `No monthly performance summaries available for Q${quarter} ${year}.`;

  // Aggregate achievements into strengths
  const achievements = reviews
    .filter(r => r.achievements)
    .map(r => `**${getMonthName(r.month)}**:\n${r.achievements}`);
  
  const aggregatedStrengths = achievements.length > 0
    ? `Quarterly Achievements & Strengths:\n\n${achievements.join("\n\n")}`
    : "";

  // Aggregate challenges into areas for improvement
  const challenges = reviews
    .filter(r => r.challenges)
    .map(r => `**${getMonthName(r.month)}**:\n${r.challenges}`);
  
  const aggregatedImprovements = challenges.length > 0
    ? `Quarterly Challenges & Areas for Improvement:\n\n${challenges.join("\n\n")}`
    : "";

  // Aggregate goals progress
  const goalsProgress = reviews
    .filter(r => r.goals_progress)
    .map(r => `**${getMonthName(r.month)}**:\n${r.goals_progress}`);
  
  const aggregatedGoals = goalsProgress.length > 0
    ? `Goals Progress Through Quarter:\n\n${goalsProgress.join("\n\n")}`
    : "";

  // Aggregate manager notes
  const managerNotes = reviews
    .filter(r => r.manager_notes)
    .map(r => `**${getMonthName(r.month)}**:\n${r.manager_notes}`);
  
  const aggregatedComments = managerNotes.length > 0
    ? `Monthly Manager Notes:\n\n${managerNotes.join("\n\n")}`
    : "";

  // Calculate trend
  const scoreTrend = calculateScoreTrend(scores);

  return {
    overall_kpi_score: averageScore,
    performance_summary: aggregatedSummary,
    strengths: aggregatedStrengths,
    areas_for_improvement: aggregatedImprovements,
    goals_next_quarter: aggregatedGoals,
    manager_comments: aggregatedComments,
    monthly_reviews: reviews,
    aggregation_metadata: {
      months_included: reviews.map(r => r.month),
      total_months: reviews.length,
      complete_months: completeReviews.length,
      average_kpi_score: averageScore,
      score_trend: scoreTrend,
    },
  };
}

/**
 * Check if all monthly reviews for a quarter are complete
 */
export async function areMonthlyReviewsComplete(
  employeeId: string,
  quarter: number,
  year: number
): Promise<{
  allComplete: boolean;
  completedMonths: number[];
  missingMonths: number[];
  totalExpected: number;
}> {
  const quarterMonths = getQuarterMonths(quarter);

  const { data: reviews, error } = await supabase
    .from("monthly_reviews")
    .select("month, status")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .in("month", quarterMonths);

  if (error) {
    throw new Error(`Failed to check monthly reviews: ${error.message}`);
  }

  const completedMonths = (reviews || [])
    .filter(r => r.status === "complete" || r.status === "approved")
    .map(r => r.month);

  const missingMonths = quarterMonths.filter(m => !completedMonths.includes(m));

  return {
    allComplete: completedMonths.length === quarterMonths.length,
    completedMonths,
    missingMonths,
    totalExpected: quarterMonths.length,
  };
}

/**
 * Get a summary of monthly review completion status for an employee
 */
export async function getMonthlyReviewCompletionStatus(
  employeeId: string,
  year: number
): Promise<{
  q1: { complete: boolean; months: number };
  q2: { complete: boolean; months: number };
  q3: { complete: boolean; months: number };
  q4: { complete: boolean; months: number };
  totalComplete: number;
  totalExpected: number;
}> {
  const { data: reviews, error } = await supabase
    .from("monthly_reviews")
    .select("month, status")
    .eq("employee_id", employeeId)
    .eq("year", year);

  if (error) {
    throw new Error(`Failed to fetch completion status: ${error.message}`);
  }

  const completedMonths = (reviews || [])
    .filter(r => r.status === "complete" || r.status === "approved")
    .map(r => r.month);

  const getQuarterStatus = (quarter: number) => {
    const months = getQuarterMonths(quarter);
    const completed = months.filter(m => completedMonths.includes(m)).length;
    return {
      complete: completed === 3,
      months: completed,
    };
  };

  return {
    q1: getQuarterStatus(1),
    q2: getQuarterStatus(2),
    q3: getQuarterStatus(3),
    q4: getQuarterStatus(4),
    totalComplete: completedMonths.length,
    totalExpected: 12,
  };
}
