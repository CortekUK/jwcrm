import { supabase } from "@/integrations/supabase/client";

export interface ReviewSummary {
  overallScore: number | null;
  performanceLevel: "excellent" | "good" | "needs_improvement" | "not_evaluated";
  narrativeSummary: string;
  strengths: string[];
  improvements: string[];
  quarterComparison: string | null;
  totalKPIs: number;
  evaluatedKPIs: number;
  kpisAboveTarget: number;
  kpisBelowTarget: number;
}

interface KPIEvaluation {
  kpi_id: string;
  achieved_value: number | null;
  score: number | null;
  status: string | null;
  kpi: {
    id: string;
    name: string;
    target_value: number;
    unit: string;
    weighting: number;
  };
}

interface Employee {
  full_name: string;
}

// Helper to get months in a quarter
const getMonthsInQuarter = (quarter: number): number[] => {
  const startMonth = (quarter - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2];
};

// Get previous quarter info
const getPreviousQuarter = (quarter: number, year: number): { quarter: number; year: number } => {
  if (quarter === 1) {
    return { quarter: 4, year: year - 1 };
  }
  return { quarter: quarter - 1, year };
};

// Calculate weighted score from evaluations
const calculateWeightedScore = (evaluations: KPIEvaluation[]): number | null => {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  evaluations.forEach((evaluation) => {
    if (evaluation.score !== null && evaluation.kpi) {
      totalWeightedScore += (evaluation.score * evaluation.kpi.weighting) / 100;
      totalWeight += evaluation.kpi.weighting;
    }
  });

  return totalWeight > 0 ? Math.round(totalWeightedScore * 100) / 100 : null;
};

// Get performance level from score
const getPerformanceLevel = (score: number | null): ReviewSummary["performanceLevel"] => {
  if (score === null) return "not_evaluated";
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  return "needs_improvement";
};

// Generate narrative summary text
const generateNarrative = (
  employeeName: string,
  score: number | null,
  performanceLevel: string,
  evaluatedKPIs: number,
  totalKPIs: number,
  kpisAboveTarget: number,
  kpisBelowTarget: number,
  topKPIs: { name: string; score: number }[],
  lowKPIs: { name: string; score: number }[]
): string => {
  if (score === null || evaluatedKPIs === 0) {
    return `${employeeName} has not been evaluated for this quarter. No KPI data is available to generate a performance summary.`;
  }

  const performanceText = 
    performanceLevel === "excellent" ? "excellent performance" :
    performanceLevel === "good" ? "good performance" :
    "performance that needs improvement";

  let summary = `${employeeName} achieved an overall score of ${score}%, demonstrating ${performanceText} this quarter. `;

  // KPI completion info
  summary += `Out of ${totalKPIs} assigned KPIs, ${evaluatedKPIs} were evaluated. `;

  // Target achievement
  if (kpisAboveTarget > 0) {
    summary += `${kpisAboveTarget} KPI${kpisAboveTarget > 1 ? "s" : ""} exceeded or met the target. `;
  }
  if (kpisBelowTarget > 0) {
    summary += `${kpisBelowTarget} KPI${kpisBelowTarget > 1 ? "s" : ""} fell below expectations. `;
  }

  // Top performing areas
  if (topKPIs.length > 0) {
    const topNames = topKPIs.map(k => k.name).join(", ");
    summary += `Notable strengths include: ${topNames}. `;
  }

  // Areas needing attention
  if (lowKPIs.length > 0) {
    const lowNames = lowKPIs.map(k => k.name).join(", ");
    summary += `Areas requiring attention: ${lowNames}.`;
  }

  return summary;
};

// Generate strengths list
const generateStrengths = (
  topKPIs: { name: string; score: number; target: number; achieved: number; unit: string }[]
): string[] => {
  return topKPIs.map((kpi) => {
    if (kpi.achieved >= kpi.target) {
      const percentAbove = Math.round(((kpi.achieved - kpi.target) / kpi.target) * 100);
      return `${kpi.name}: Achieved ${kpi.achieved} ${kpi.unit} (${percentAbove}% above target of ${kpi.target} ${kpi.unit}) with a score of ${kpi.score}%`;
    }
    return `${kpi.name}: Strong performance with a score of ${kpi.score}%`;
  });
};

// Generate improvements list
const generateImprovements = (
  lowKPIs: { name: string; score: number; target: number; achieved: number; unit: string }[]
): string[] => {
  return lowKPIs.map((kpi) => {
    const percentBelow = Math.round(((kpi.target - kpi.achieved) / kpi.target) * 100);
    return `${kpi.name}: Achieved ${kpi.achieved} ${kpi.unit} (${percentBelow}% below target of ${kpi.target} ${kpi.unit}) with a score of ${kpi.score}%`;
  });
};

export async function generateReviewSummary(
  employeeId: string,
  quarter: number,
  year: number
): Promise<ReviewSummary> {
  const months = getMonthsInQuarter(quarter);

  // Fetch employee name
  const { data: employeeData } = await supabase
    .from("employees")
    .select("full_name")
    .eq("id", employeeId)
    .single();

  const employeeName = employeeData?.full_name || "Employee";

  // Fetch all evaluations for the quarter
  const { data: evaluationsData, error } = await supabase
    .from("kpi_evaluations")
    .select(`
      kpi_id,
      achieved_value,
      score,
      status,
      month,
      kpi:kpis(id, name, target_value, unit, weighting)
    `)
    .eq("employee_id", employeeId)
    .eq("year", year)
    .in("month", months);

  if (error) {
    console.error("Error fetching KPI evaluations:", error);
    throw error;
  }

  const evaluations = (evaluationsData || []).filter(e => e.kpi) as unknown as (KPIEvaluation & { month: number })[];

  // Aggregate by KPI (average across months)
  const kpiMap = new Map<string, {
    kpi: KPIEvaluation["kpi"];
    totalAchieved: number;
    totalScore: number;
    monthCount: number;
  }>();

  evaluations.forEach((evaluation) => {
    const existing = kpiMap.get(evaluation.kpi_id);
    if (existing) {
      if (evaluation.achieved_value !== null) {
        existing.totalAchieved += evaluation.achieved_value;
        existing.monthCount++;
      }
      if (evaluation.score !== null) {
        existing.totalScore += evaluation.score;
      }
    } else {
      kpiMap.set(evaluation.kpi_id, {
        kpi: evaluation.kpi,
        totalAchieved: evaluation.achieved_value ?? 0,
        totalScore: evaluation.score ?? 0,
        monthCount: evaluation.achieved_value !== null ? 1 : 0,
      });
    }
  });

  // Calculate aggregated evaluations
  const aggregatedEvaluations: KPIEvaluation[] = Array.from(kpiMap.values()).map((item) => ({
    kpi_id: item.kpi.id,
    kpi: item.kpi,
    achieved_value: item.monthCount > 0 ? Math.round((item.totalAchieved / item.monthCount) * 100) / 100 : null,
    score: item.monthCount > 0 ? Math.round((item.totalScore / item.monthCount) * 100) / 100 : null,
    status: item.monthCount > 0 ? "completed" : "pending",
  }));

  // Calculate metrics
  const totalKPIs = aggregatedEvaluations.length;
  const evaluatedKPIs = aggregatedEvaluations.filter(e => e.score !== null).length;
  const overallScore = calculateWeightedScore(aggregatedEvaluations);
  const performanceLevel = getPerformanceLevel(overallScore);

  // Identify KPIs above/below target
  const evaluatedWithScores = aggregatedEvaluations
    .filter(e => e.score !== null && e.achieved_value !== null)
    .map(e => ({
      name: e.kpi.name,
      score: e.score!,
      target: e.kpi.target_value,
      achieved: e.achieved_value!,
      unit: e.kpi.unit,
      aboveTarget: e.achieved_value! >= e.kpi.target_value,
    }));

  const kpisAboveTarget = evaluatedWithScores.filter(k => k.aboveTarget).length;
  const kpisBelowTarget = evaluatedWithScores.filter(k => !k.aboveTarget).length;

  // Get top and low performing KPIs
  const sortedByScore = [...evaluatedWithScores].sort((a, b) => b.score - a.score);
  const topKPIs = sortedByScore.filter(k => k.score >= 80).slice(0, 3);
  const lowKPIs = sortedByScore.filter(k => k.score < 70).slice(-3).reverse();

  // Compare to previous quarter
  let quarterComparison: string | null = null;
  const prevQuarter = getPreviousQuarter(quarter, year);
  const prevMonths = getMonthsInQuarter(prevQuarter.quarter);

  const { data: prevEvaluationsData } = await supabase
    .from("kpi_evaluations")
    .select(`
      kpi_id,
      achieved_value,
      score,
      status,
      kpi:kpis(id, name, target_value, unit, weighting)
    `)
    .eq("employee_id", employeeId)
    .eq("year", prevQuarter.year)
    .in("month", prevMonths);

  if (prevEvaluationsData && prevEvaluationsData.length > 0) {
    const prevEvaluations = prevEvaluationsData.filter(e => e.kpi) as unknown as KPIEvaluation[];
    
    // Aggregate previous quarter
    const prevKpiMap = new Map<string, {
      kpi: KPIEvaluation["kpi"];
      totalScore: number;
      monthCount: number;
    }>();

    prevEvaluations.forEach((evaluation) => {
      const existing = prevKpiMap.get(evaluation.kpi_id);
      if (existing) {
        if (evaluation.score !== null) {
          existing.totalScore += evaluation.score;
          existing.monthCount++;
        }
      } else if (evaluation.score !== null) {
        prevKpiMap.set(evaluation.kpi_id, {
          kpi: evaluation.kpi,
          totalScore: evaluation.score,
          monthCount: 1,
        });
      }
    });

    const prevAggregated: KPIEvaluation[] = Array.from(prevKpiMap.values()).map((item) => ({
      kpi_id: item.kpi.id,
      kpi: item.kpi,
      achieved_value: null,
      score: item.monthCount > 0 ? Math.round((item.totalScore / item.monthCount) * 100) / 100 : null,
      status: "completed",
    }));

    const prevScore = calculateWeightedScore(prevAggregated);

    if (prevScore !== null && overallScore !== null) {
      const diff = Math.round((overallScore - prevScore) * 100) / 100;
      if (diff > 0) {
        quarterComparison = `Improved by ${Math.abs(diff)}% compared to Q${prevQuarter.quarter} ${prevQuarter.year} (${prevScore}%)`;
      } else if (diff < 0) {
        quarterComparison = `Decreased by ${Math.abs(diff)}% compared to Q${prevQuarter.quarter} ${prevQuarter.year} (${prevScore}%)`;
      } else {
        quarterComparison = `Performance remained stable compared to Q${prevQuarter.quarter} ${prevQuarter.year} (${prevScore}%)`;
      }
    }
  }

  // Generate narrative
  const narrativeSummary = generateNarrative(
    employeeName,
    overallScore,
    performanceLevel,
    evaluatedKPIs,
    totalKPIs,
    kpisAboveTarget,
    kpisBelowTarget,
    topKPIs,
    lowKPIs
  );

  // Generate strengths and improvements
  const strengths = generateStrengths(topKPIs);
  const improvements = generateImprovements(lowKPIs);

  return {
    overallScore,
    performanceLevel,
    narrativeSummary,
    strengths,
    improvements,
    quarterComparison,
    totalKPIs,
    evaluatedKPIs,
    kpisAboveTarget,
    kpisBelowTarget,
  };
}
