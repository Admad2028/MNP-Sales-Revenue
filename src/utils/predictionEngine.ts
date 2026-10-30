import { SheetRecord } from "../types";

export interface DayOfWeekProfile {
  dayIndex: number; // 0 (Sun) to 6 (Sat)
  dayName: string; // "Sun", "Mon", ...
  fullDayName: string;
  isWeekend: boolean;
  totalVolume: number;
  occurrences: number;
  avgDaily: number;
  relativeWeight: number; // relative to overall daily avg (e.g. 1.25 = 25% above avg)
}

export interface FutureDayForecast {
  dayNum: number;
  dateStr: string;
  dayName: string;
  fullDateStr: string;
  isWeekend: boolean;
  dayIndex: number;
  projectedDaily: number;
  projectedCumulative: number;
  dowWeight: number;
  phaseMultiplier: number;
}

export interface AdvancedPredictionResult {
  isPredictionActive: boolean;
  currentMonthKey: string;
  currentMonthLabel: string;
  currentLatestDay: number;
  totalDaysInMonth: number;
  remainingDaysCount: number;
  remainingWeekdaysCount: number;
  remainingWeekendDaysCount: number;
  
  // Current Month Actuals
  currentMTDTotal: number;
  currentMTDDailyAvg: number;

  // Previous Month Phase Analytics
  prevMonthKey: string | null;
  prevMonthLabel: string | null;
  prevMonthTotal: number;
  prevEarlyPhaseTotal: number;
  prevEarlyPhaseDailyAvg: number;
  prevLatePhaseTotal: number;
  prevLatePhaseDailyAvg: number;
  phaseAccelerationFactor: number; // e.g. 1.15 (+15% surge in late phase)
  phaseSurgePct: number;

  // Day of Week Analytics
  dowProfiles: DayOfWeekProfile[];
  weekdayHistoricalAvg: number;
  weekendHistoricalAvg: number;
  weekdayRatioVsWeekend: number; // e.g. 4.2x higher on weekdays

  // Forecast Outputs
  projectedRemainingTotal: number;
  projectedMonthEndTotal: number;
  projectedWeekdayDailyAvg: number;
  projectedWeekendDailyAvg: number;
  
  // Naive Baseline comparison
  linearRunRateMonthEnd: number;
  modelDeltaVsLinear: number;
  modelDeltaPctVsLinear: number;

  // Day-by-day schedule for remaining days
  futureSchedule: FutureDayForecast[];
  // Combined 1..31 trajectory map for chart
  dailyTrajectoryMap: Record<number, { daily: number; cumulative: number; isProjected: boolean; isPivot?: boolean }>;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Advanced Multi-Factor Forecast Engine:
 * Combines:
 * 1. Current Month's run-rate & momentum
 * 2. Day-of-week sensitivity (Mon-Fri vs Sat-Sun actual velocity)
 * 3. Historical Phase Performance (late-month closing rush/surge factor from prior month)
 * 4. Exact calendar mapping for each remaining day in the month
 */
export function calculateAdvancedPrediction({
  records,
  currentMonthKey,
  currentLatestDay,
  totalDaysInMonth,
  metricMode,
  priorMonthsCount = 3,
}: {
  records: SheetRecord[];
  currentMonthKey: string;
  currentLatestDay: number;
  totalDaysInMonth: number;
  metricMode: "dealAmount" | "aaCommission" | "dealsClosed";
  priorMonthsCount?: number;
}): AdvancedPredictionResult {
  const isMonthCompleted = currentLatestDay >= totalDaysInMonth;
  const remainingDaysCount = Math.max(0, totalDaysInMonth - currentLatestDay);

  // 1. Identify distinct sorted months in history (ensuring current month is always present)
  const monthKeysSet = new Set<string>();
  monthKeysSet.add(currentMonthKey);
  records.forEach((r) => {
    if (r.date && r.date.length >= 7) {
      monthKeysSet.add(r.date.substring(0, 7));
    }
  });
  const sortedMonths = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));
  const prevMonthKey = sortedMonths.length > 1 ? sortedMonths[1] : null;

  // Extract year & month number for current month
  const [currYearStr, currMonthStr] = currentMonthKey.split("-");
  const currYear = parseInt(currYearStr, 10) || 2026;
  const currMonthNum = parseInt(currMonthStr, 10) || 8;
  const tempCurrDate = new Date(currYear, currMonthNum - 1, 1);
  const currentMonthLabel = tempCurrDate.toLocaleString("en-US", { month: "short", year: "numeric" });

  let prevMonthLabel: string | null = null;
  if (prevMonthKey) {
    const [pYearStr, pMonthStr] = prevMonthKey.split("-");
    const pYear = parseInt(pYearStr, 10);
    const pMonthNum = parseInt(pMonthStr, 10);
    const tempPDate = new Date(pYear, pMonthNum - 1, 1);
    prevMonthLabel = tempPDate.toLocaleString("en-US", { month: "short", year: "numeric" });
  }

  // 2. Compute Current Month MTD and Daily stats
  let currentMTDTotal = 0;
  const currentDailyMap: Record<number, number> = {};
  for (let d = 1; d <= 31; d++) currentDailyMap[d] = 0;

  records.forEach((r) => {
    if (r.date.startsWith(currentMonthKey)) {
      const dayNum = parseInt(r.date.substring(8, 10), 10);
      if (dayNum >= 1 && dayNum <= currentLatestDay) {
        const val = metricMode === "aaCommission" ? r.aaCommission : metricMode === "dealsClosed" ? r.dealsClosed : r.dealAmount;
        currentDailyMap[dayNum] = (currentDailyMap[dayNum] || 0) + val;
        currentMTDTotal += val;
      }
    }
  });

  const currentMTDDailyAvg = currentLatestDay > 0 ? currentMTDTotal / currentLatestDay : 0;

  // 3. Day of Week Historical Analysis (using current month MTD + previous 3 months)
  const relevantMonths = sortedMonths.slice(0, priorMonthsCount + 1);
  const dowAgg: Array<{ total: number; count: number; dateSet: Set<string> }> = Array.from({ length: 7 }, () => ({
    total: 0,
    count: 0,
    dateSet: new Set<string>(),
  }));

  // Daily totals grouped by ISO date string
  const dateTotals: Record<string, number> = {};
  records.forEach((r) => {
    const mKey = r.date.substring(0, 7);
    if (relevantMonths.includes(mKey)) {
      const val = metricMode === "aaCommission" ? r.aaCommission : metricMode === "dealsClosed" ? r.dealsClosed : r.dealAmount;
      dateTotals[r.date] = (dateTotals[r.date] || 0) + val;
    }
  });

  // Now aggregate unique dates into day-of-week bins
  Object.entries(dateTotals).forEach(([dateStr, val]) => {
    // Parse YYYY-MM-DD safely
    const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay(); // 0 = Sun, 6 = Sat
      dowAgg[dow].total += val;
      dowAgg[dow].dateSet.add(dateStr);
    }
  });

  // Calculate Average and Relative Weight for each DOW
  let overallSum = 0;
  let overallDays = 0;
  dowAgg.forEach((b) => {
    overallSum += b.total;
    overallDays += b.dateSet.size;
  });
  const overallHistoricalDailyAvg = overallDays > 0 ? overallSum / overallDays : 1;

  let weekdaySum = 0;
  let weekdayDays = 0;
  let weekendSum = 0;
  let weekendDays = 0;

  const dowProfiles: DayOfWeekProfile[] = dowAgg.map((bin, dayIdx) => {
    const isWeekend = dayIdx === 0 || dayIdx === 6;
    const occurrences = bin.dateSet.size;
    const avgDaily = occurrences > 0 ? bin.total / occurrences : 0;
    
    // Relative weight normalized against historical average
    // If no data, provide a realistic default (weekdays ~1.2, Sat ~0.5, Sun ~0.1)
    let relativeWeight = overallHistoricalDailyAvg > 0 ? avgDaily / overallHistoricalDailyAvg : 1.0;
    if (occurrences === 0) {
      relativeWeight = isWeekend ? (dayIdx === 0 ? 0.05 : 0.4) : 1.25;
    }

    if (isWeekend) {
      weekendSum += bin.total;
      weekendDays += occurrences;
    } else {
      weekdaySum += bin.total;
      weekdayDays += occurrences;
    }

    return {
      dayIndex: dayIdx,
      dayName: DAY_NAMES[dayIdx],
      fullDayName: FULL_DAY_NAMES[dayIdx],
      isWeekend,
      totalVolume: bin.total,
      occurrences,
      avgDaily,
      relativeWeight,
    };
  });

  const weekdayHistoricalAvg = weekdayDays > 0 ? weekdaySum / weekdayDays : overallHistoricalDailyAvg;
  const weekendHistoricalAvg = weekendDays > 0 ? weekendSum / weekendDays : overallHistoricalDailyAvg * 0.25;
  const weekdayRatioVsWeekend = weekendHistoricalAvg > 0 ? weekdayHistoricalAvg / weekendHistoricalAvg : 5.0;

  // 4. Previous Month Late-Phase vs Early-Phase Analysis
  let prevMonthTotal = 0;
  let prevEarlyPhaseTotal = 0;
  let prevLatePhaseTotal = 0;
  let prevEarlyDaysCount = 0;
  let prevLateDaysCount = 0;

  if (prevMonthKey) {
    records.forEach((r) => {
      if (r.date.startsWith(prevMonthKey)) {
        const dayNum = parseInt(r.date.substring(8, 10), 10);
        const val = metricMode === "aaCommission" ? r.aaCommission : metricMode === "dealsClosed" ? r.dealsClosed : r.dealAmount;
        prevMonthTotal += val;

        if (dayNum <= currentLatestDay) {
          prevEarlyPhaseTotal += val;
          prevEarlyDaysCount = Math.max(prevEarlyDaysCount, dayNum);
        } else {
          prevLatePhaseTotal += val;
          prevLateDaysCount++;
        }
      }
    });
  }

  const effectiveEarlyDays = Math.max(1, Math.min(currentLatestDay, 25));
  const prevEarlyPhaseDailyAvg = prevEarlyDaysCount > 0 ? prevEarlyPhaseTotal / effectiveEarlyDays : 0;
  const remainingWindowDays = Math.max(1, totalDaysInMonth - currentLatestDay);
  const prevLatePhaseDailyAvg = prevLateDaysCount > 0 ? prevLatePhaseTotal / remainingWindowDays : 0;

  // Phase Acceleration Factor (How much late-month velocity surged vs early-month in benchmark)
  let phaseAccelerationFactor = 1.0;
  if (prevEarlyPhaseDailyAvg > 0 && prevLatePhaseDailyAvg > 0) {
    const rawRatio = prevLatePhaseDailyAvg / prevEarlyPhaseDailyAvg;
    // Damped factor (smooth between 0.70x and 1.60x to prevent over-fitting outliers)
    phaseAccelerationFactor = Math.max(0.7, Math.min(1.6, 0.5 + 0.5 * rawRatio));
  } else {
    // If no prior month phase data, assume a standard late-month sprint boost of 10%
    phaseAccelerationFactor = 1.10;
  }
  const phaseSurgePct = (phaseAccelerationFactor - 1) * 100;

  // 5. Day-by-Day Forecast Generation for Remaining Days
  const futureSchedule: FutureDayForecast[] = [];
  const dailyTrajectoryMap: Record<number, { daily: number; cumulative: number; isProjected: boolean; isPivot?: boolean }> = {};

  // Fill in past actuals into trajectory map
  let runningActual = 0;
  for (let d = 1; d <= currentLatestDay; d++) {
    const dayVal = currentDailyMap[d] || 0;
    runningActual += dayVal;
    dailyTrajectoryMap[d] = {
      daily: dayVal,
      cumulative: runningActual,
      isProjected: false,
      isPivot: d === currentLatestDay,
    };
  }

  let runningProjected = runningActual;
  let totalProjectedRemaining = 0;
  let remainingWeekdaysCount = 0;
  let remainingWeekendDaysCount = 0;
  let projectedWeekdaySum = 0;
  let projectedWeekendSum = 0;

  if (!isMonthCompleted) {
    for (let d = currentLatestDay + 1; d <= totalDaysInMonth; d++) {
      const dt = new Date(currYear, currMonthNum - 1, d);
      const dow = dt.getDay(); // 0 = Sun .. 6 = Sat
      const isWeekend = dow === 0 || dow === 6;
      const dowProfile = dowProfiles[dow];
      const dowWeight = dowProfile.relativeWeight;

      if (isWeekend) {
        remainingWeekendDaysCount++;
      } else {
        remainingWeekdaysCount++;
      }

      // Base blended daily projection:
      // Combines:
      // (a) Current month MTD daily avg scaled by DOW weight & late-month surge
      // (b) Prior month phase daily avg scaled by DOW weight
      const currentScaledDaily = currentMTDDailyAvg * dowWeight * phaseAccelerationFactor;
      const historicalAnchorDaily = (prevLatePhaseDailyAvg > 0 ? prevLatePhaseDailyAvg : overallHistoricalDailyAvg) * dowWeight;
      const prevScaledDaily = prevLatePhaseDailyAvg > 0 && currentMTDDailyAvg > 0 && prevEarlyPhaseDailyAvg > 0
        ? prevLatePhaseDailyAvg * dowWeight * (currentMTDDailyAvg / prevEarlyPhaseDailyAvg)
        : historicalAnchorDaily;

      let calculatedDaily = 0;
      if (currentMTDDailyAvg > 0 && currentLatestDay > 0) {
        // As days are logged in current month, progressively weight current run-rate
        const currentWeight = Math.min(0.85, 0.40 + (currentLatestDay / 20) * 0.45);
        const priorWeight = 1 - currentWeight;
        calculatedDaily = Math.round(currentWeight * currentScaledDaily + priorWeight * prevScaledDaily);
      } else {
        // No entries yet in current month (e.g. Day 1 before logging): project cleanly from historical baseline
        calculatedDaily = Math.round(historicalAnchorDaily * (phaseAccelerationFactor || 1.0));
      }
      const projectedDaily = Math.max(0, calculatedDaily);

      runningProjected += projectedDaily;
      totalProjectedRemaining += projectedDaily;

      if (isWeekend) {
        projectedWeekendSum += projectedDaily;
      } else {
        projectedWeekdaySum += projectedDaily;
      }

      const dateStr = `${currYear}-${String(currMonthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const fullDateStr = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

      futureSchedule.push({
        dayNum: d,
        dateStr,
        dayName: DAY_NAMES[dow],
        fullDateStr,
        isWeekend,
        dayIndex: dow,
        projectedDaily,
        projectedCumulative: runningProjected,
        dowWeight,
        phaseMultiplier: phaseAccelerationFactor,
      });

      dailyTrajectoryMap[d] = {
        daily: projectedDaily,
        cumulative: runningProjected,
        isProjected: true,
      };
    }
  }

  const projectedMonthEndTotal = isMonthCompleted ? currentMTDTotal : runningProjected;
  const projectedWeekdayDailyAvg = remainingWeekdaysCount > 0 ? projectedWeekdaySum / remainingWeekdaysCount : 0;
  const projectedWeekendDailyAvg = remainingWeekendDaysCount > 0 ? projectedWeekendSum / remainingWeekendDaysCount : 0;

  // Comparison with naive linear run-rate
  const linearRunRateMonthEnd = Math.round(currentMTDDailyAvg * totalDaysInMonth);
  const modelDeltaVsLinear = projectedMonthEndTotal - linearRunRateMonthEnd;
  const modelDeltaPctVsLinear = linearRunRateMonthEnd > 0 ? (modelDeltaVsLinear / linearRunRateMonthEnd) * 100 : 0;

  return {
    isPredictionActive: !isMonthCompleted,
    currentMonthKey,
    currentMonthLabel,
    currentLatestDay,
    totalDaysInMonth,
    remainingDaysCount,
    remainingWeekdaysCount,
    remainingWeekendDaysCount,
    currentMTDTotal,
    currentMTDDailyAvg,
    prevMonthKey,
    prevMonthLabel,
    prevMonthTotal,
    prevEarlyPhaseTotal,
    prevEarlyPhaseDailyAvg,
    prevLatePhaseTotal,
    prevLatePhaseDailyAvg,
    phaseAccelerationFactor,
    phaseSurgePct,
    dowProfiles,
    weekdayHistoricalAvg,
    weekendHistoricalAvg,
    weekdayRatioVsWeekend,
    projectedRemainingTotal: totalProjectedRemaining,
    projectedMonthEndTotal,
    projectedWeekdayDailyAvg,
    projectedWeekendDailyAvg,
    linearRunRateMonthEnd,
    modelDeltaVsLinear,
    modelDeltaPctVsLinear,
    futureSchedule,
    dailyTrajectoryMap,
  };
}
