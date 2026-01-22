import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  department_id: string | null;
  department?: { id: string; name: string } | null;
  start_date: string;
  employment_status: string;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid';
  start_date: string;
  end_date: string;
  total_days: number;
  status: 'pending' | 'approved' | 'denied';
  reason: string | null;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: 'present' | 'late' | 'wfh' | 'on_leave' | 'sick_leave' | 'absent';
  check_in_time: string | null;
}

interface EmployeeLeaveStats {
  employee_id: string;
  employee_name: string;
  department: string;
  total_requests: number;
  total_days: number;
  by_type: Record<string, number>;
  by_day_of_week: Record<number, number>; // 0=Sunday, 4=Thursday
  recent_requests: Array<{
    type: string;
    start_date: string;
    end_date: string;
    days: number;
  }>;
}

interface EmployeeAttendanceStats {
  employee_id: string;
  employee_name: string;
  department: string;
  total_late: number;
  total_absent: number;
  total_present: number;
  late_by_day: Record<number, number>;
  late_rate: number;
}

interface DepartmentStats {
  name: string;
  employee_count: number;
  total_leave_days: number;
  avg_leave_per_employee: number;
  sick_leave_ratio: number;
  total_late_count: number;
}

// UAE Public Holidays 2026 (approximate)
const UAE_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'New Year' },
  { date: '2026-03-20', name: 'Eid Al Fitr (approx)' },
  { date: '2026-03-21', name: 'Eid Al Fitr (approx)' },
  { date: '2026-03-22', name: 'Eid Al Fitr (approx)' },
  { date: '2026-05-27', name: 'Eid Al Adha (approx)' },
  { date: '2026-05-28', name: 'Eid Al Adha (approx)' },
  { date: '2026-05-29', name: 'Eid Al Adha (approx)' },
  { date: '2026-05-30', name: 'Eid Al Adha (approx)' },
  { date: '2026-06-17', name: 'Islamic New Year (approx)' },
  { date: '2026-08-26', name: 'Prophet Birthday (approx)' },
  { date: '2026-12-01', name: 'Commemoration Day' },
  { date: '2026-12-02', name: 'UAE National Day' },
  { date: '2026-12-03', name: 'UAE National Day' },
];

function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

// Parse date string (YYYY-MM-DD) and get day of week without timezone issues
function getDayOfWeekFromDateString(dateStr: string): number {
  // Parse as local date to avoid UTC timezone shift
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return date.getDay();
}

function aggregateLeaveData(
  employees: Employee[],
  leaveRequests: LeaveRequest[]
): EmployeeLeaveStats[] {
  const statsMap = new Map<string, EmployeeLeaveStats>();

  // Initialize all employees
  for (const emp of employees) {
    statsMap.set(emp.id, {
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department?.name || 'Unassigned',
      total_requests: 0,
      total_days: 0,
      by_type: { annual: 0, sick: 0, emergency: 0, unpaid: 0 },
      by_day_of_week: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      recent_requests: [],
    });
  }

  // Aggregate leave requests
  for (const leave of leaveRequests) {
    const stats = statsMap.get(leave.employee_id);
    if (!stats) continue;

    stats.total_requests++;
    stats.total_days += leave.total_days;
    stats.by_type[leave.leave_type] = (stats.by_type[leave.leave_type] || 0) + leave.total_days;

    // Track day of week for start date (use timezone-safe parsing)
    const startDay = getDayOfWeekFromDateString(leave.start_date);
    stats.by_day_of_week[startDay] = (stats.by_day_of_week[startDay] || 0) + 1;

    // Track recent requests (last 10)
    if (stats.recent_requests.length < 10) {
      stats.recent_requests.push({
        type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        days: leave.total_days,
      });
    }
  }

  return Array.from(statsMap.values()).filter(s => s.total_requests > 0);
}

function aggregateAttendanceData(
  employees: Employee[],
  attendance: AttendanceRecord[]
): EmployeeAttendanceStats[] {
  const statsMap = new Map<string, EmployeeAttendanceStats>();

  // Initialize all employees
  for (const emp of employees) {
    statsMap.set(emp.id, {
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department?.name || 'Unassigned',
      total_late: 0,
      total_absent: 0,
      total_present: 0,
      late_by_day: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      late_rate: 0,
    });
  }

  // Aggregate attendance
  for (const record of attendance) {
    const stats = statsMap.get(record.employee_id);
    if (!stats) continue;

    if (record.status === 'late') {
      stats.total_late++;
      const dayOfWeek = getDayOfWeekFromDateString(record.date);
      stats.late_by_day[dayOfWeek] = (stats.late_by_day[dayOfWeek] || 0) + 1;
    } else if (record.status === 'absent') {
      stats.total_absent++;
    } else if (record.status === 'present' || record.status === 'wfh') {
      stats.total_present++;
    }
  }

  // Calculate late rate
  for (const stats of statsMap.values()) {
    const totalWorkDays = stats.total_present + stats.total_late + stats.total_absent;
    if (totalWorkDays > 0) {
      stats.late_rate = Math.round((stats.total_late / totalWorkDays) * 100);
    }
  }

  return Array.from(statsMap.values()).filter(s =>
    s.total_late > 0 || s.total_absent > 0 || s.total_present > 0
  );
}

function aggregateDepartmentData(
  employees: Employee[],
  leaveStats: EmployeeLeaveStats[],
  attendanceStats: EmployeeAttendanceStats[]
): DepartmentStats[] {
  const deptMap = new Map<string, DepartmentStats>();

  // Initialize departments
  for (const emp of employees) {
    const deptName = emp.department?.name || 'Unassigned';
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, {
        name: deptName,
        employee_count: 0,
        total_leave_days: 0,
        avg_leave_per_employee: 0,
        sick_leave_ratio: 0,
        total_late_count: 0,
      });
    }
    const dept = deptMap.get(deptName)!;
    dept.employee_count++;
  }

  // Aggregate leave by department
  for (const stats of leaveStats) {
    const dept = deptMap.get(stats.department);
    if (dept) {
      dept.total_leave_days += stats.total_days;
    }
  }

  // Aggregate lateness by department
  for (const stats of attendanceStats) {
    const dept = deptMap.get(stats.department);
    if (dept) {
      dept.total_late_count += stats.total_late;
    }
  }

  // Calculate averages
  for (const dept of deptMap.values()) {
    if (dept.employee_count > 0) {
      dept.avg_leave_per_employee = Math.round(dept.total_leave_days / dept.employee_count * 10) / 10;
    }
  }

  return Array.from(deptMap.values());
}

function buildGPTPrompt(
  leaveStats: EmployeeLeaveStats[],
  attendanceStats: EmployeeAttendanceStats[],
  departmentStats: DepartmentStats[],
  periodStart: string,
  periodEnd: string,
  totalEmployees: number
): string {
  // Calculate company-wide averages
  const totalLeaveRequests = leaveStats.reduce((sum, s) => sum + s.total_requests, 0);
  const totalLeaveDays = leaveStats.reduce((sum, s) => sum + s.total_days, 0);
  const totalLate = attendanceStats.reduce((sum, s) => sum + s.total_late, 0);

  // Calculate day-of-week distribution with exact counts
  const dayOfWeekTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const stats of leaveStats) {
    for (let d = 0; d <= 6; d++) {
      dayOfWeekTotals[d] += stats.by_day_of_week[d] || 0;
    }
  }

  // Create detailed day-of-week breakdown with counts AND percentages
  const dayOfWeekDetails: Record<string, { count: number; percentage: number }> = {};
  for (let d = 0; d <= 6; d++) {
    const count = dayOfWeekTotals[d];
    const pct = totalLeaveRequests > 0 ? Math.round((count / totalLeaveRequests) * 100) : 0;
    dayOfWeekDetails[getDayName(d)] = { count, percentage: pct };
  }

  // Calculate sick leave specific stats
  const sickLeaveDetails: Array<{ employee: string; start_date: string; day: string }> = [];
  for (const stats of leaveStats) {
    for (const req of stats.recent_requests) {
      if (req.type === 'sick') {
        const dayOfWeek = getDayOfWeekFromDateString(req.start_date);
        sickLeaveDetails.push({
          employee: stats.employee_name,
          start_date: req.start_date,
          day: getDayName(dayOfWeek),
        });
      }
    }
  }

  // Filter to only employees with notable patterns
  const notableLeaveStats = leaveStats.filter(s => s.total_requests >= 2);
  const notableLateStats = attendanceStats.filter(s => s.total_late >= 3);

  return `You are an expert HR analytics assistant analyzing employee leave and attendance patterns.

## CRITICAL INSTRUCTIONS
- You MUST ONLY report patterns that are EXPLICITLY present in the data provided below
- DO NOT invent, assume, or hallucinate any patterns not supported by the actual numbers
- Every insight MUST cite specific numbers from the data
- If a pattern is not clearly evident (e.g., less than 30% difference from average), do NOT report it
- When mentioning a day (e.g., "Sunday sick leaves"), first CHECK if any sick leaves actually start on that day in the data

## Company Context
- Work week: Sunday-Thursday (UAE standard)
- Weekend: Friday-Saturday
- Total active employees: ${totalEmployees}
- Analysis period: ${periodStart} to ${periodEnd}

## Company-Wide Summary (EXACT COUNTS - use these numbers)
- Total leave requests analyzed: ${totalLeaveRequests}
- Total leave days taken: ${totalLeaveDays}
- Total late arrivals recorded: ${totalLate}

## Leave Start Day Distribution (EXACT COUNTS)
${Object.entries(dayOfWeekDetails).map(([day, data]) => `- ${day}: ${data.count} requests (${data.percentage}%)`).join('\n')}

## Sick Leave Details (ALL sick leaves in data)
${sickLeaveDetails.length > 0
  ? sickLeaveDetails.map(s => `- ${s.employee}: ${s.start_date} (${s.day})`).join('\n')
  : '- No sick leave requests in the analyzed period'}

## UAE Public Holidays (for context)
${UAE_HOLIDAYS_2026.map(h => `- ${h.date}: ${h.name}`).join('\n')}

## Employee Leave Patterns (employees with 2+ requests)
${notableLeaveStats.length > 0
  ? JSON.stringify(notableLeaveStats.map(s => ({
      name: s.employee_name,
      department: s.department,
      total_requests: s.total_requests,
      total_days: s.total_days,
      by_type: s.by_type,
      start_day_distribution: Object.entries(s.by_day_of_week)
        .filter(([_, count]) => count > 0)
        .map(([day, count]) => `${getDayName(parseInt(day))}: ${count}`)
        .join(', '),
      recent_leaves: s.recent_requests.slice(0, 5),
    })), null, 2)
  : 'No employees with 2+ leave requests'}

## Employee Attendance Patterns (employees with 3+ late arrivals)
${notableLateStats.length > 0
  ? JSON.stringify(notableLateStats.map(s => ({
      name: s.employee_name,
      department: s.department,
      total_late: s.total_late,
      total_present: s.total_present,
      total_absent: s.total_absent,
      late_rate: `${s.late_rate}%`,
      late_by_day: Object.entries(s.late_by_day)
        .filter(([_, count]) => count > 0)
        .map(([day, count]) => `${getDayName(parseInt(day))}: ${count}`)
        .join(', '),
    })), null, 2)
  : 'No employees with 3+ late arrivals'}

## Department Summary
${JSON.stringify(departmentStats, null, 2)}

---

Based ONLY on the data above, analyze and identify:
1. **Day-of-week patterns** - Only if a specific day has significantly higher leave starts (>30% of total)
2. **Sick leave patterns** - Only based on the ACTUAL sick leave dates listed above
3. **Punctuality issues** - Based on the actual late counts and rates provided
4. **Department anomalies** - Departments with notably different patterns
5. **Coverage risks** - Overlapping leaves in same department
6. **Balance alerts** - Employees with unusually high leave consumption

Return your analysis as JSON in this exact structure:
{
  "summary": "2-3 sentence executive summary based ONLY on actual data patterns",
  "insights": [
    {
      "category": "day_of_week_pattern|sick_leave_pattern|punctuality_pattern|department_anomaly|coverage_risk|balance_alert",
      "severity": "high|medium|low",
      "title": "Brief descriptive title",
      "description": "Finding with EXACT numbers from the data (e.g., '4 out of 10 requests' not '40%')",
      "affected_employees": ["Only list employees ACTUALLY in the data"],
      "recommendation": "Specific actionable recommendation for HR",
      "evidence": {
        "actual_count": "exact number from data",
        "percentage": "calculated percentage",
        "data_source": "which section of data this comes from"
      }
    }
  ],
  "department_health": {
    "Department Name": {
      "score": 0-100,
      "concerns": ["only concerns supported by data"],
      "positive": ["positive observations from data"]
    }
  },
  "alerts": [
    {
      "type": "coverage_gap|pattern_warning|punctuality_critical",
      "urgency": "immediate|this_week|this_month",
      "message": "Clear alert message with specific data",
      "action_required": "What HR should do"
    }
  ]
}

STRICT RULES:
1. DO NOT claim patterns that don't exist in the data (e.g., don't claim "Sunday sick leaves" if no sick leave starts on Sunday)
2. Every percentage must match the actual counts provided
3. Only include employees who appear in the data above
4. If there are no significant patterns, return fewer insights rather than inventing patterns
5. For lateness: only flag if late_rate > 30% AND total_late >= 3
6. For day patterns: only flag if one day has >30% of all requests
7. Return ONLY valid JSON, no markdown or explanations outside the JSON`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting leave pattern analysis...');

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Calculate date range (last 12 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    const periodStart = startDate.toISOString().split('T')[0];
    const periodEnd = endDate.toISOString().split('T')[0];

    console.log(`Analyzing data from ${periodStart} to ${periodEnd}`);

    // Fetch active employees with departments
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        full_name,
        email,
        department_id,
        department:departments(id, name),
        start_date,
        employment_status
      `)
      .eq('employment_status', 'active');

    if (empError) {
      throw new Error(`Failed to fetch employees: ${empError.message}`);
    }

    if (!employees || employees.length === 0) {
      console.log('No active employees found');
      return new Response(
        JSON.stringify({ success: true, message: 'No employees to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${employees.length} active employees`);

    // Fetch leave requests (approved and pending)
    const { data: leaveRequests, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*')
      .in('status', ['approved', 'pending'])
      .gte('start_date', periodStart)
      .lte('start_date', periodEnd);

    if (leaveError) {
      throw new Error(`Failed to fetch leave requests: ${leaveError.message}`);
    }

    console.log(`Found ${leaveRequests?.length || 0} leave requests`);

    // Fetch attendance records
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (attError) {
      throw new Error(`Failed to fetch attendance: ${attError.message}`);
    }

    console.log(`Found ${attendance?.length || 0} attendance records`);

    // Aggregate data
    const leaveStats = aggregateLeaveData(employees as Employee[], leaveRequests || []);
    const attendanceStats = aggregateAttendanceData(employees as Employee[], attendance || []);
    const departmentStats = aggregateDepartmentData(
      employees as Employee[],
      leaveStats,
      attendanceStats
    );

    console.log('Data aggregated, calling GPT...');

    // Build prompt and call GPT
    const prompt = buildGPTPrompt(
      leaveStats,
      attendanceStats,
      departmentStats,
      periodStart,
      periodEnd,
      employees.length
    );

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Log data summary for debugging
    console.log('Data summary being sent to GPT:');
    console.log(`- Leave stats: ${leaveStats.length} employees with leave data`);
    console.log(`- Attendance stats: ${attendanceStats.length} employees with attendance data`);
    console.log(`- Notable leave (2+ requests): ${leaveStats.filter(s => s.total_requests >= 2).length}`);
    console.log(`- Notable late (3+ arrivals): ${attendanceStats.filter(s => s.total_late >= 3).length}`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR analytics assistant. You MUST respond with valid JSON only. You MUST NOT invent or hallucinate patterns - only report what is explicitly present in the provided data. If asked about sick leaves on Sundays but no sick leaves start on Sunday in the data, DO NOT claim there is a Sunday sick leave pattern.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2500,
      temperature: 0.1, // Lower temperature for more factual, less creative responses
    });

    const gptResponse = completion.choices[0]?.message?.content;
    if (!gptResponse) {
      throw new Error('No response from GPT');
    }

    console.log('GPT response received');

    // Parse GPT response
    let analysisResult;
    try {
      // Clean response (remove markdown code blocks if present)
      let jsonContent = gptResponse.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
      }
      analysisResult = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', gptResponse.substring(0, 500));
      throw new Error('Invalid JSON response from GPT');
    }

    // Store results in database
    const { data: insertedResult, error: insertError } = await supabase
      .from('leave_analytics_results')
      .insert({
        summary: analysisResult.summary || 'Analysis completed',
        insights: analysisResult.insights || [],
        department_health: analysisResult.department_health || {},
        alerts: analysisResult.alerts || [],
        data_period_start: periodStart,
        data_period_end: periodEnd,
        employee_count: employees.length,
        total_leave_requests: leaveRequests?.length || 0,
        total_attendance_records: attendance?.length || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store results:', insertError);
      // Don't throw - still return the analysis
    } else {
      console.log('Analysis stored with ID:', insertedResult?.id);
    }

    // Clean up old results (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabase
      .from('leave_analytics_results')
      .delete()
      .lt('analysis_date', thirtyDaysAgo.toISOString());

    console.log('Leave pattern analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analysis completed',
        result_id: insertedResult?.id,
        summary: analysisResult.summary,
        insights_count: analysisResult.insights?.length || 0,
        alerts_count: analysisResult.alerts?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-leave-patterns:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
