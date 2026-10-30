import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { SheetRecord, AnomalyRecord } from "../types";
import {
  formatINR,
  formatDateDisplay,
  formatDateShort,
  getDefaultDateRange,
  getDatesInRange,
  getPreviousMonthDate,
  getISTDateString,
  parseDateToISO,
} from "../utils/sheetParser";
import {
  TrendingUp,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Users,
  CalendarRange,
  CalendarDays,
  Info,
  Calendar,
  AlertTriangle,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";

interface MonthlyComparisonChartProps {
  records: SheetRecord[];
  salesperson: string;
  startDate?: string;
  endDate?: string;
  anomalies?: AnomalyRecord[];
}

// Color palette for comparative months
const MONTH_COLORS = [
  { stroke: "#10b981", fill: "#10b981", label: "Current Month", badge: "bg-emerald-50 text-emerald-700 border-emerald-300" }, // Emerald
  { stroke: "#6366f1", fill: "#6366f1", label: "Previous Month", badge: "bg-indigo-50 text-indigo-700 border-indigo-300" }, // Indigo
  { stroke: "#f59e0b", fill: "#f59e0b", label: "2 Mo Prior", badge: "bg-amber-50 text-amber-700 border-amber-300" }, // Amber
  { stroke: "#a855f7", fill: "#a855f7", label: "3 Mo Prior", badge: "bg-purple-50 text-purple-700 border-purple-300" }, // Purple
  { stroke: "#06b6d4", fill: "#06b6d4", label: "4 Mo Prior", badge: "bg-cyan-50 text-cyan-700 border-cyan-300" }, // Cyan
  { stroke: "#64748b", fill: "#64748b", label: "Prior", badge: "bg-slate-50 text-slate-700 border-slate-300" }, // Slate
];

interface MonthMeta {
  key: string; // "2026-08"
  label: string; // "Aug 2026"
  fullLabel: string; // "August 2026"
  relativeLabel: string;
  daysInMonth: number;
  totalSales: number;
  totalCommission: number;
  totalDeals: number;
  maxDayLogged: number;
  mtdSales: number;
  mtdCommission: number;
  mtdDeals: number;
  dailyMap: Record<
    number,
    { dealAmount: number; aaCommission: number; dealsClosed: number }
  >;
  cumulativeMap: Record<
    number,
    { dealAmount: number; aaCommission: number; dealsClosed: number }
  >;
}

export function MonthlyComparisonChart({
  records,
  salesperson,
  startDate,
  endDate,
  anomalies = [],
}: MonthlyComparisonChartProps) {
  // Chart Scope: By default "monthlyBenchmark" (Multi-Month 1-31 comparison)
  const [chartScope, setChartScope] = useState<"monthlyBenchmark" | "selectedRange">("monthlyBenchmark");
  // Trajectory Mode: Cumulative (Running total) vs Daily
  const [trajectoryMode, setTrajectoryMode] = useState<"cumulative" | "daily">("cumulative");
  // Metric Mode: dealAmount vs aaCommission vs dealsClosed
  const [metricMode, setMetricMode] = useState<"dealAmount" | "aaCommission" | "dealsClosed">("dealAmount");
  // Show/hide visual anomaly highlight bands on the chart
  const [showAnomalyBands, setShowAnomalyBands] = useState<boolean>(true);
  // Active months filter for multi-month mode
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>([]);

  // Compute effective date bounds (defaults to 1st of current month to today if blank)
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    const def = getDefaultDateRange();
    return {
      effectiveStartDate: startDate || def.startDate,
      effectiveEndDate: endDate || def.endDate,
    };
  }, [startDate, endDate]);

  // Helper to check if a salesperson is affected by an anomaly
  const isRepAffected = (affected: string, rep: string) => {
    if (!affected || rep === "All") return true;
    const aff = affected.toLowerCase();
    if (aff.includes("whole") || aff.includes("team") || aff.includes("all")) return true;
    return aff.includes(rep.toLowerCase());
  };

  // Filter records matching selected salesperson
  const filteredSalespersonRecords = useMemo(() => {
    return records.filter((r) => {
      if (salesperson !== "All" && r.executive.toLowerCase() !== salesperson.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [records, salesperson]);

  // ==========================================
  // 1. DATASET A: MULTI-MONTH DAY 1 TO 31 WITH PREDICTION (DEFAULT)
  // ==========================================
  const { availableMonths, currentLatestDay, isCurrentMonthOver, totalDaysInCurrentMonth } = useMemo(() => {
    const todayIST = getISTDateString(0);
    const [currentYearStr, currentMonthNumStr, currentDayStr] = todayIST.split("-");
    const activeCurrentMonthKey = `${currentYearStr}-${currentMonthNumStr}`;
    const todayDayNum = Math.max(1, parseInt(currentDayStr, 10) || 1);

    const monthKeysSet = new Set<string>();
    // Always include the current active month (e.g., September 2026)
    monthKeysSet.add(activeCurrentMonthKey);

    filteredSalespersonRecords.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        monthKeysSet.add(r.date.substring(0, 7)); // "YYYY-MM"
      }
    });

    const sortedMonthKeys = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));

    if (sortedMonthKeys.length === 0) {
      return { availableMonths: [], currentLatestDay: 31, isCurrentMonthOver: true, totalDaysInCurrentMonth: 31 };
    }

    const currentMonthKey = sortedMonthKeys[0];
    let maxRecordedDay = 0;
    let hasCurrentMonthRecords = false;

    filteredSalespersonRecords.forEach((r) => {
      if (r.date.startsWith(currentMonthKey)) {
        const dayNum = parseInt(r.date.substring(8, 10), 10);
        if (!isNaN(dayNum) && dayNum >= 1) {
          hasCurrentMonthRecords = true;
          if (dayNum > maxRecordedDay) {
            maxRecordedDay = dayNum;
          }
        }
      }
    });

    // If records exist for current month, latest day is maxRecordedDay.
    // If no records logged yet (e.g. Day 1 of September), latest day is today's day of month
    const latestDayInCurrentMonth = hasCurrentMonthRecords ? Math.max(1, maxRecordedDay) : todayDayNum;

    const [currYearStr, currMonthStr] = currentMonthKey.split("-");
    const daysInCurrMonth = new Date(parseInt(currYearStr, 10), parseInt(currMonthStr, 10), 0).getDate();
    const isCalendarCurrentMonth = currentMonthKey === activeCurrentMonthKey;
    const monthIsOver = !isCalendarCurrentMonth ? true : (latestDayInCurrentMonth >= daysInCurrMonth && hasCurrentMonthRecords);

    const monthList: MonthMeta[] = sortedMonthKeys.map((mKey, idx) => {
      const [yearStr, monthStr] = mKey.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);

      const tempDate = new Date(year, monthNum - 1, 1);
      const fullMonthName = tempDate.toLocaleString("en-US", { month: "long" });
      const shortMonthName = tempDate.toLocaleString("en-US", { month: "short" });
      const label = `${shortMonthName} ${year}`;
      const fullLabel = `${fullMonthName} ${year}`;

      let relativeLabel = "Prior Month";
      if (idx === 0) relativeLabel = "Current Month";
      else if (idx === 1) relativeLabel = "Previous Month";
      else if (idx === 2) relativeLabel = "2 Months Prior";
      else if (idx === 3) relativeLabel = "3 Months Prior";
      else relativeLabel = `${idx} Months Prior`;

      const daysInMonth = new Date(year, monthNum, 0).getDate();

      const dailyMap: Record<number, { dealAmount: number; aaCommission: number; dealsClosed: number }> = {};
      for (let d = 1; d <= 31; d++) {
        dailyMap[d] = { dealAmount: 0, aaCommission: 0, dealsClosed: 0 };
      }

      let maxDayLogged = 0;
      let totalSales = 0;
      let totalCommission = 0;
      let totalDeals = 0;

      filteredSalespersonRecords.forEach((r) => {
        if (r.date.startsWith(mKey)) {
          const day = parseInt(r.date.substring(8, 10), 10);
          if (day >= 1 && day <= 31) {
            dailyMap[day].dealAmount += r.dealAmount;
            dailyMap[day].aaCommission += r.aaCommission;
            dailyMap[day].dealsClosed += r.dealsClosed;

            totalSales += r.dealAmount;
            totalCommission += r.aaCommission;
            totalDeals += r.dealsClosed;

            if (day > maxDayLogged) {
              maxDayLogged = day;
            }
          }
        }
      });

      const cumulativeMap: Record<number, { dealAmount: number; aaCommission: number; dealsClosed: number }> = {};
      let runningSales = 0;
      let runningCommission = 0;
      let runningDeals = 0;

      for (let d = 1; d <= 31; d++) {
        runningSales += dailyMap[d].dealAmount;
        runningCommission += dailyMap[d].aaCommission;
        runningDeals += dailyMap[d].dealsClosed;

        cumulativeMap[d] = {
          dealAmount: runningSales,
          aaCommission: runningCommission,
          dealsClosed: runningDeals,
        };
      }

      const activePacingDay = idx === 0 ? Math.min(latestDayInCurrentMonth, 31) : Math.min(daysInMonth, 31);
      const mtdSales = cumulativeMap[activePacingDay]?.dealAmount || 0;
      const mtdCommission = cumulativeMap[activePacingDay]?.aaCommission || 0;
      const mtdDeals = cumulativeMap[activePacingDay]?.dealsClosed || 0;

      return {
        key: mKey,
        label,
        fullLabel,
        relativeLabel,
        daysInMonth,
        totalSales,
        totalCommission,
        totalDeals,
        maxDayLogged: idx === 0 ? latestDayInCurrentMonth : Math.max(maxDayLogged, daysInMonth),
        mtdSales,
        mtdCommission,
        mtdDeals,
        dailyMap,
        cumulativeMap,
      };
    });

    return {
      availableMonths: monthList,
      currentLatestDay: latestDayInCurrentMonth,
      isCurrentMonthOver: monthIsOver,
      totalDaysInCurrentMonth: daysInCurrMonth,
    };
  }, [filteredSalespersonRecords]);

  // Active months filter for multi-month mode: by default, show ONLY the current month (availableMonths[0])
  const activeMonthKeys = useMemo(() => {
    if (availableMonths.length === 0) return [];
    const currentMonthKey = availableMonths[0].key;
    if (selectedMonthKeys.length === 0) {
      // By default: ONLY show the current month on the graph!
      return [currentMonthKey];
    }
    const valid = selectedMonthKeys.filter((k) => availableMonths.some((m) => m.key === k));
    return valid.length > 0 ? valid : [currentMonthKey];
  }, [availableMonths, selectedMonthKeys]);

  const toggleMonth = (mKey: string) => {
    if (activeMonthKeys.includes(mKey)) {
      if (activeMonthKeys.length > 1) {
        setSelectedMonthKeys(activeMonthKeys.filter((k) => k !== mKey));
      }
    } else {
      setSelectedMonthKeys([...activeMonthKeys, mKey]);
    }
  };

  const currentMonth = availableMonths[0];
  const prevMonth = availableMonths[1];

  // Anomalies relevant strictly to the active months currently selected on the 1-31 graph
  // STRICT RULE: Only show the anomaly when the month for it is selected on the graph!
  const activeMultiMonthAnomalies = useMemo(() => {
    if (!anomalies || anomalies.length === 0 || activeMonthKeys.length === 0) return [];
    return anomalies
      .filter((a) => {
        if (!isRepAffected(a.affected, salesperson)) return false;
        const startM = a.startDate.slice(0, 7);
        const endM = a.endDate.slice(0, 7);
        // Only show if the month for this anomaly is currently selected in activeMonthKeys on the graph!
        return activeMonthKeys.includes(startM) || activeMonthKeys.includes(endM);
      })
      .map((a) => {
        const startM = a.startDate.slice(0, 7);
        const matchingMonth = availableMonths.find((m) => m.key === startM);
        const monthLabel = matchingMonth ? matchingMonth.label : startM;
        const monthFullLabel = matchingMonth ? matchingMonth.fullLabel : startM;
        const startDayNum = Math.max(1, parseInt(a.startDate.slice(8, 10), 10) || 1);
        const endDayNum = Math.min(31, Math.max(startDayNum, parseInt(a.endDate.slice(8, 10), 10) || startDayNum));
        return {
          ...a,
          monthKey: startM,
          monthLabel,
          monthFullLabel,
          startDayNum,
          endDayNum,
        };
      });
  }, [anomalies, activeMonthKeys, availableMonths, salesperson]);

  // Anomalies relevant to the selected custom date range
  const activeRangeAnomalies = useMemo(() => {
    if (!anomalies || anomalies.length === 0 || !effectiveStartDate || !effectiveEndDate) return [];
    return anomalies.filter((a) => {
      if (!isRepAffected(a.affected, salesperson)) return false;
      return a.startDate <= effectiveEndDate && a.endDate >= effectiveStartDate;
    });
  }, [anomalies, effectiveStartDate, effectiveEndDate, salesperson]);

  // 31-day normalized chart dataset
  const monthChartData = useMemo(() => {
    if (availableMonths.length === 0) return [];
    const data: Array<Record<string, any>> = [];

    const curLatestDay = Math.max(1, currentLatestDay);

    // Include Day 0 (start of month baseline at 0) so the solid line from start to current date is always visible
    const startDay = 0;

    for (let day = startDay; day <= 31; day++) {
      const row: Record<string, any> = {
        day: day === 0 ? "Start" : `Day ${day}`,
        dayNum: day,
      };

      // Check if this day falls within any active anomaly for the selected months
      if (day > 0 && activeMultiMonthAnomalies.length > 0) {
        const matchingAnomalies = activeMultiMonthAnomalies.filter((a) => {
          return day >= a.startDayNum && day <= a.endDayNum;
        });
        if (matchingAnomalies.length > 0) {
          row["anomalies"] = matchingAnomalies;
          row["anomaly"] = matchingAnomalies[0];
        }
      }

      availableMonths.forEach((m, idx) => {
        const isCurrentMonth = idx === 0;
        if (day === 0) {
          row[m.key] = 0;
          row[`${m.key}_daily`] = 0;
          row[`${m.key}_deals`] = 0;
          row[`${m.key}_cumSales`] = 0;
        } else if (isCurrentMonth && day > curLatestDay) {
          row[m.key] = undefined;
          row[`${m.key}_daily`] = undefined;
          row[`${m.key}_deals`] = undefined;
        } else {
          const stats = trajectoryMode === "cumulative" ? m.cumulativeMap[day] : m.dailyMap[day];
          row[m.key] = stats ? stats[metricMode] : 0;
          row[`${m.key}_daily`] = m.dailyMap[day]?.[metricMode] || 0;
          row[`${m.key}_deals`] = m.dailyMap[day]?.dealsClosed || 0;
          row[`${m.key}_cumSales`] = m.cumulativeMap[day]?.dealAmount || 0;
        }
      });

      data.push(row);
    }
    return data;
  }, [
    availableMonths,
    trajectoryMode,
    metricMode,
    currentLatestDay,
    activeMultiMonthAnomalies,
  ]);

  // ==========================================
  // 2. DATASET B: SELECTED DATE RANGE TIMELINE
  // ==========================================
  const rangeTimelineData = useMemo(() => {
    const dateList = getDatesInRange(effectiveStartDate, effectiveEndDate);
    if (dateList.length === 0) return { data: [], stats: null };

    // Group actual records by date
    const dailyMap: Record<
      string,
      { dealAmount: number; aaCommission: number; dealsClosed: number; genuineCalls: number }
    > = {};

    filteredSalespersonRecords.forEach((r) => {
      if (!dailyMap[r.date]) {
        dailyMap[r.date] = { dealAmount: 0, aaCommission: 0, dealsClosed: 0, genuineCalls: 0 };
      }
      dailyMap[r.date].dealAmount += r.dealAmount;
      dailyMap[r.date].aaCommission += r.aaCommission;
      dailyMap[r.date].dealsClosed += r.dealsClosed;
      dailyMap[r.date].genuineCalls += r.genuineCalls;
    });

    let runningSales = 0;
    let runningCommission = 0;
    let runningDeals = 0;

    let prevRunningSales = 0;
    let prevRunningCommission = 0;
    let prevRunningDeals = 0;

    let peakDaySales = 0;
    let peakDayDate = "";
    let daysWithSales = 0;

    const dataRows = dateList.map((dateStr, idx) => {
      const stats = dailyMap[dateStr] || { dealAmount: 0, aaCommission: 0, dealsClosed: 0, genuineCalls: 0 };
      
      runningSales += stats.dealAmount;
      runningCommission += stats.aaCommission;
      runningDeals += stats.dealsClosed;

      if (stats.dealAmount > peakDaySales) {
        peakDaySales = stats.dealAmount;
        peakDayDate = dateStr;
      }
      if (stats.dealAmount > 0) {
        daysWithSales += 1;
      }

      // Compute equivalent comparison date in previous month (e.g. 2026-08-15 -> 2026-07-15)
      const prevDateStr = getPreviousMonthDate(dateStr);
      const prevStats = dailyMap[prevDateStr] || { dealAmount: 0, aaCommission: 0, dealsClosed: 0, genuineCalls: 0 };

      prevRunningSales += prevStats.dealAmount;
      prevRunningCommission += prevStats.aaCommission;
      prevRunningDeals += prevStats.dealsClosed;

      const formattedLabel = formatDateShort(dateStr);
      const formattedFullDate = formatDateDisplay(dateStr);
      const prevFormattedFullDate = formatDateDisplay(prevDateStr);

      let currentMetricVal = stats.dealAmount;
      let currentCumVal = runningSales;
      let prevMetricVal = prevStats.dealAmount;
      let prevCumVal = prevRunningSales;

      if (metricMode === "aaCommission") {
        currentMetricVal = stats.aaCommission;
        currentCumVal = runningCommission;
        prevMetricVal = prevStats.aaCommission;
        prevCumVal = prevRunningCommission;
      } else if (metricMode === "dealsClosed") {
        currentMetricVal = stats.dealsClosed;
        currentCumVal = runningDeals;
        prevMetricVal = prevStats.dealsClosed;
        prevCumVal = prevRunningDeals;
      }

      const matchingAnomaly = activeRangeAnomalies.find(
        (a) => a.startDate <= dateStr && dateStr <= a.endDate
      );

      return {
        date: dateStr,
        displayDate: formattedLabel,
        fullDate: formattedFullDate,
        dayNumber: idx + 1,
        anomaly: matchingAnomaly,
        // Active selected period
        currentDaily: currentMetricVal,
        currentCumulative: currentCumVal,
        actualSales: stats.dealAmount,
        actualCommission: stats.aaCommission,
        actualDeals: stats.dealsClosed,
        actualCalls: stats.genuineCalls,
        cumSales: runningSales,
        cumCommission: runningCommission,
        cumDeals: runningDeals,
        // Comparative previous period
        prevDate: prevDateStr,
        prevFullDate: prevFormattedFullDate,
        prevDaily: prevMetricVal,
        prevCumulative: prevCumVal,
        prevSales: prevStats.dealAmount,
        prevCommission: prevStats.aaCommission,
        prevDeals: prevStats.dealsClosed,
        prevCumSales: prevRunningSales,
        prevCumCommission: prevRunningCommission,
        prevCumDeals: prevRunningDeals,
      };
    });

    const totalDays = dateList.length;
    const rangeTotalSales = runningSales;
    const rangeTotalCommission = runningCommission;
    const rangeTotalDeals = runningDeals;

    const prevTotalSales = prevRunningSales;
    const prevTotalCommission = prevRunningCommission;
    const prevTotalDeals = prevRunningDeals;

    let selectedMetricTotal = rangeTotalSales;
    let prevMetricTotal = prevTotalSales;

    if (metricMode === "aaCommission") {
      selectedMetricTotal = rangeTotalCommission;
      prevMetricTotal = prevTotalCommission;
    } else if (metricMode === "dealsClosed") {
      selectedMetricTotal = rangeTotalDeals;
      prevMetricTotal = prevTotalDeals;
    }

    const growthDiff = selectedMetricTotal - prevMetricTotal;
    const growthPct = prevMetricTotal > 0
      ? (growthDiff / prevMetricTotal) * 100
      : selectedMetricTotal > 0 ? 100 : 0;

    const dailyAvg = totalDays > 0 ? selectedMetricTotal / totalDays : 0;

    return {
      data: dataRows,
      stats: {
        totalDays,
        rangeTotalSales,
        rangeTotalCommission,
        rangeTotalDeals,
        prevTotalSales,
        prevTotalCommission,
        prevTotalDeals,
        selectedMetricTotal,
        prevMetricTotal,
        growthDiff,
        growthPct,
        dailyAvg,
        peakDaySales,
        peakDayDate,
        daysWithSales,
      },
    };
  }, [effectiveStartDate, effectiveEndDate, filteredSalespersonRecords, metricMode, salesperson]);

  // Format metric value helper
  const formatValue = (val: number) => {
    if (metricMode === "dealsClosed") {
      return `${val.toLocaleString()} deal${val === 1 ? "" : "s"}`;
    }
    return formatINR(val);
  };

  const formatValueCompact = (val: number) => {
    if (metricMode === "dealsClosed") {
      return `${val.toLocaleString()} deals`;
    }
    return formatINR(val, 0);
  };

  const formatAxisY = (val: number) => {
    if (metricMode === "dealsClosed") return `${val}`;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  const getMetricName = () => {
    if (metricMode === "dealAmount") return "Sales";
    if (metricMode === "aaCommission") return "AA Commission";
    return "Deals";
  };

  const isSingleDay = effectiveStartDate === effectiveEndDate;

  // Metric figures for KPI Cards
  const curActualValue = currentMonth?.cumulativeMap[currentLatestDay]?.[metricMode] || 0;
  const curRunRate = currentLatestDay > 0 ? curActualValue / currentLatestDay : 0;

  const renderDataDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={props.r || 4.5}
        strokeWidth={props.strokeWidth || 2}
        fill={props.fill || "#059669"}
        stroke={props.stroke || "#ffffff"}
        key={`dot-${payload?.day || payload?.displayDate || payload?.dayNum}`}
      />
    );
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
      {/* Top Header & Navigation Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-xs mt-0.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                {chartScope === "monthlyBenchmark" ? (
                  <>Monthly {getMetricName()} Comparison &amp; Trajectory</>
                ) : (
                  <>
                    Sales &amp; Performance Trajectory{" "}
                    <span className="text-emerald-700 font-extrabold">
                      ({formatDateDisplay(effectiveStartDate)}{isSingleDay ? "" : ` – ${formatDateDisplay(effectiveEndDate)}`})
                    </span>
                  </>
                )}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                <Users className="w-3 h-3 text-zinc-500" />
                {salesperson === "All" ? "Whole Team" : salesperson}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {chartScope === "monthlyBenchmark" ? (
                <>
                  Comparing performance across {availableMonths.length} consecutive calendar months (Day 1 to 31 timeline)
                </>
              ) : (
                <>
                  Tracking {metricMode === "dealAmount" ? "revenue" : metricMode === "aaCommission" ? "commission" : "deal closures"} day-by-day across {rangeTimelineData.stats?.totalDays || 0} days vs previous benchmark
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls: Scope View, Trajectory Mode, & Metric Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Selector: Multi-Month (Default) vs Selected Date Range */}
          <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50 text-xs">
            <button
              type="button"
              onClick={() => setChartScope("monthlyBenchmark")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                chartScope === "monthlyBenchmark"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
              title="Compare all consecutive calendar months (Day 1 to 31)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Multi-Month (1–31)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartScope("selectedRange")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                chartScope === "selectedRange"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
              title="Display stats and timeline strictly for the selected date range"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Selected Date Range</span>
            </button>
          </div>

          {/* Cumulative vs Daily toggle */}
          <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50 text-xs">
            <button
              type="button"
              onClick={() => setTrajectoryMode("cumulative")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                trajectoryMode === "cumulative"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Cumulative</span>
            </button>
            <button
              type="button"
              onClick={() => setTrajectoryMode("daily")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                trajectoryMode === "daily"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Daily</span>
            </button>
          </div>

          {/* Metric Selector */}
          <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50 text-xs">
            <button
              type="button"
              onClick={() => setMetricMode("dealAmount")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                metricMode === "dealAmount"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Sales (₹)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("aaCommission")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                metricMode === "aaCommission"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              AA Comm (₹)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("dealsClosed")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                metricMode === "dealsClosed"
                  ? "bg-zinc-800 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Deals
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SCOPE A: STATS CARDS FOR MULTI-MONTH (DAY 1-31) (DEFAULT)  */}
      {/* ========================================================= */}
      {chartScope === "monthlyBenchmark" && currentMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Current Month Actual MTD */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                {currentMonth.fullLabel} (MTD Day {currentLatestDay})
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 block">
                {formatValue(curActualValue)}
              </span>
              <span className="text-xs text-zinc-600">
                {currentMonth.totalDeals} deals closed • {formatINR(currentMonth.totalCommission)} commission
              </span>
            </div>
          </div>

          {/* Card 2: Previous Month Benchmark on matching day */}
          {prevMonth ? (
            <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
                  {prevMonth.fullLabel} (Paced to Day {currentLatestDay})
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100"></span>
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 block">
                  {formatValue(prevMonth.cumulativeMap[currentLatestDay]?.[metricMode] || 0)}
                </span>
                <span className="text-xs text-zinc-600">
                  Full month total was {formatINR(prevMonth.totalSales)} ({prevMonth.totalDeals} deals)
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Run-Rate Velocity
              </span>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 block">
                  ~{formatValueCompact(curRunRate)}/day
                </span>
                <span className="text-xs text-zinc-500">
                  Across {currentLatestDay} recorded days
                </span>
              </div>
            </div>
          )}

          {/* Card 3: Pace Variance vs Previous Month */}
          {prevMonth ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Pace vs {prevMonth.label} (Day {currentLatestDay})
              </span>
              <div className="mt-2">
                {(() => {
                  const prv = prevMonth.cumulativeMap[currentLatestDay]?.[metricMode] || 0;
                  const diff = curActualValue - prv;
                  const pct = prv > 0 ? (diff / prv) * 100 : 0;
                  return (
                    <div>
                      <span
                        className={`text-xl sm:text-2xl font-extrabold flex items-center gap-1 ${
                          diff >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {diff >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                        {Math.abs(pct).toFixed(1)}%
                      </span>
                      <span className="text-xs text-zinc-500">
                        {diff >= 0 ? "+" : "-"}{formatValue(Math.abs(diff))} vs {prevMonth.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Days Remaining in Month
              </span>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 block">
                  {Math.max(0, totalDaysInCurrentMonth - currentLatestDay)} days
                </span>
                <span className="text-xs text-zinc-500">
                  Total {totalDaysInCurrentMonth} days in {currentMonth.label}
                </span>
              </div>
            </div>
          )}

          {/* Card 4: Daily Average Run-Rate */}
          <div className="bg-zinc-900 text-white border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Average Daily Run-Rate
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {currentMonth.label}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-white block tracking-tight">
                ~{formatValueCompact(curRunRate)}/day
              </span>
              <div className="text-xs text-zinc-300 mt-1 flex items-center justify-between">
                <span>
                  Actual MTD (Day {currentLatestDay} of {totalDaysInCurrentMonth})
                </span>
                {!isCurrentMonthOver && (
                  <span className="text-zinc-400 font-medium text-[11px]">
                    {Math.max(0, totalDaysInCurrentMonth - currentLatestDay)} days left
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCOPE B: STATS CARDS FOR SELECTED DATE RANGE              */}
      {/* ========================================================= */}
      {chartScope === "selectedRange" && rangeTimelineData.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Selected Period Total
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 block">
                {formatValue(rangeTimelineData.stats.selectedMetricTotal)}
              </span>
              <span className="text-xs text-zinc-600 block mt-0.5">
                {rangeTimelineData.stats.rangeTotalDeals} deals closed • {formatINR(rangeTimelineData.stats.rangeTotalCommission)} commission
              </span>
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
                Prior Month Benchmark
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100"></span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 block">
                {formatValue(rangeTimelineData.stats.prevMetricTotal)}
              </span>
              <span className="text-xs text-zinc-600 block mt-0.5">
                {rangeTimelineData.stats.prevTotalDeals} deals ({formatINR(rangeTimelineData.stats.prevTotalSales)} sales)
              </span>
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Range Variance vs Prior Month
            </span>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <span
                  className={`text-xl sm:text-2xl font-extrabold flex items-center gap-1 ${
                    rangeTimelineData.stats.growthDiff >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {rangeTimelineData.stats.growthDiff >= 0 ? (
                    <ArrowUpRight className="w-6 h-6" />
                  ) : (
                    <ArrowDownRight className="w-6 h-6" />
                  )}
                  {Math.abs(rangeTimelineData.stats.growthPct).toFixed(1)}%
                </span>
                <span className="text-xs text-zinc-500 block mt-0.5">
                  {rangeTimelineData.stats.growthDiff >= 0 ? "+" : "-"}
                  {formatValue(Math.abs(rangeTimelineData.stats.growthDiff))} variance
                </span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 text-white border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Velocity in Window
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {rangeTimelineData.stats.totalDays} day{rangeTimelineData.stats.totalDays === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-extrabold text-white block tracking-tight">
                ~{formatValueCompact(rangeTimelineData.stats.dailyAvg)}/day
              </span>
              <div className="text-xs text-zinc-300 mt-1 flex items-center justify-between">
                <span>
                  {rangeTimelineData.stats.daysWithSales} active sales day{rangeTimelineData.stats.daysWithSales === 1 ? "" : "s"}
                </span>
                {rangeTimelineData.stats.peakDaySales > 0 && (
                  <span className="text-emerald-300 font-semibold">
                    Peak: {formatINR(rangeTimelineData.stats.peakDaySales, 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Month Series Toggles & Comparison Controls (Visible in Multi-Month Mode) */}
      {chartScope === "monthlyBenchmark" && (
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Primary Current Month Indicator & Toggle */}
              {currentMonth && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-400" /> Active Month:
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleMonth(currentMonth.key)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      activeMonthKeys.includes(currentMonth.key)
                        ? "bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs ring-1 ring-emerald-400/40"
                        : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200/80"
                    }`}
                    title={
                      activeMonthKeys.includes(currentMonth.key)
                        ? "Current month is active on the graph (click to toggle)"
                        : "Click to show current month on the graph"
                    }
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: activeMonthKeys.includes(currentMonth.key) ? "#059669" : "#a1a1aa" }}
                    ></span>
                    <span>{currentMonth.fullLabel}</span>
                    <span className="text-[10px] font-medium opacity-80">(Current Month)</span>
                    {activeMonthKeys.includes(currentMonth.key) && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
                    )}
                  </button>
                </div>
              )}

              {/* Options to Select & Compare Previous Months */}
              {availableMonths.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1 sm:pl-2 sm:border-l sm:border-zinc-200">
                  <span className="text-xs font-medium text-zinc-400 flex items-center gap-1 mr-0.5">
                    Compare:
                  </span>
                  {availableMonths.slice(1).map((m, idx) => {
                    const colorMeta = MONTH_COLORS[(idx + 1) % MONTH_COLORS.length];
                    const isSelected = activeMonthKeys.includes(m.key);

                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggleMonth(m.key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                          isSelected
                            ? `${colorMeta.badge} shadow-xs ring-1 ring-zinc-300`
                            : "bg-white text-zinc-600 border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                        }`}
                        title={isSelected ? `Remove ${m.fullLabel} from comparison` : `Add ${m.fullLabel} to graph comparison`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isSelected ? colorMeta.stroke : "#cbd5e1" }}
                        ></span>
                        <span>{isSelected ? m.fullLabel : `+ ${m.label}`}</span>
                        <span className="text-[10px] opacity-75">
                          ({m.relativeLabel})
                        </span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 ml-0.5 opacity-90" />}
                      </button>
                    );
                  })}

                  {/* Reset to Current Month Only button if any previous month is selected */}
                  {activeMonthKeys.some((k) => k !== currentMonth?.key) && (
                    <button
                      type="button"
                      onClick={() => currentMonth && setSelectedMonthKeys([currentMonth.key])}
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 underline underline-offset-2 px-1.5 py-1"
                    >
                      Reset to Current Month Only
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logged Google Sheet Anomalies Notification Bar */}
      {(() => {
        const displayedAnomalies = chartScope === "monthlyBenchmark" ? activeMultiMonthAnomalies : activeRangeAnomalies;
        if (displayedAnomalies.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-xs text-amber-900">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Operational Anomalies ({displayedAnomalies.length}):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {displayedAnomalies.map((anom: any) => (
                  <div
                    key={anom.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/95 border border-amber-300/90 rounded-xl text-amber-900 font-medium shadow-xs text-xs"
                  >
                    {(anom.monthFullLabel || anom.monthLabel) && (
                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-bold rounded text-[10px] uppercase tracking-wide">
                        {anom.monthFullLabel || anom.monthLabel}
                      </span>
                    )}
                    <span className="font-bold text-amber-900">{anom.anomaly}</span>
                    <span className="text-amber-700 text-[11px]">
                      ({anom.rawStartDate}
                      {anom.rawEndDate && anom.rawEndDate !== anom.rawStartDate ? `–${anom.rawEndDate}` : ""})
                    </span>
                    {anom.remarks && <span className="text-zinc-500 text-[11px] hidden md:inline">• {anom.remarks}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Toggle Anomaly Highlight on Chart */}
            <button
              type="button"
              onClick={() => setShowAnomalyBands(!showAnomalyBands)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                showAnomalyBands
                  ? "bg-amber-200 text-amber-900 hover:bg-amber-300 border border-amber-300"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
              title={showAnomalyBands ? "Click to hide anomaly highlights on chart for a cleaner view" : "Click to show anomaly highlights on chart"}
            >
              {showAnomalyBands ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showAnomalyBands ? "Chart Shading: ON" : "Chart Shading: OFF"}</span>
            </button>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 3. RECHARTS LINE GRAPH AREA                               */}
      {/* ========================================================= */}
      <div className="w-full h-80 sm:h-96 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartScope === "monthlyBenchmark" ? (
            /* Multi-Month Normalized Day 1 to 31 Chart with Prediction */
            <LineChart
              data={monthChartData}
              margin={{ top: 10, right: 15, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f4f4f5"
                vertical={false}
              />

              {/* Highlighted Anomaly Vertical Bands for Selected Active Months */}
              {showAnomalyBands &&
                activeMultiMonthAnomalies.map((a) => {
                  const aStartDay = Math.max(1, a.startDayNum);
                  const aEndDay = Math.min(31, a.endDayNum);
                  return (
                    <ReferenceArea
                      key={`anom-area-${a.id}`}
                      x1={`Day ${aStartDay}`}
                      x2={`Day ${aEndDay}`}
                      fill="#fef3c7"
                      fillOpacity={0.2}
                      stroke="#f59e0b"
                      strokeOpacity={0.4}
                      strokeDasharray="3 3"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}
              {showAnomalyBands &&
                activeMultiMonthAnomalies.map((a) => {
                  const aStartDay = Math.max(1, a.startDayNum);
                  return (
                    <ReferenceLine
                      key={`anom-line-${a.id}`}
                      x={`Day ${aStartDay}`}
                      stroke="#f59e0b"
                      strokeWidth={1}
                      strokeOpacity={0.6}
                      strokeDasharray="3 3"
                      style={{ pointerEvents: "none" }}
                      label={{
                        value: `⚠️ ${a.anomaly.length > 20 ? a.anomaly.slice(0, 18) + "…" : a.anomaly}`,
                        position: "insideTopLeft",
                        fill: "#b45309",
                        fontSize: 9,
                        fontWeight: 600,
                        opacity: 0.85,
                      }}
                    />
                  );
                })}
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={{ stroke: "#e4e4e7" }}
                tick={{ fill: "#71717a", fontSize: 11 }}
                interval={1}
                dy={8}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "#e4e4e7" }}
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={formatAxisY}
                width={65}
              />
              <Tooltip
                wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;
                  const dayNum = item.dayNum;

                  return (
                    <div className="bg-zinc-900/95 backdrop-blur-xs text-white rounded-xl p-3 shadow-xl border border-zinc-800 text-xs min-w-[220px] max-w-[280px] space-y-2 pointer-events-none select-none">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-100 text-sm">Day {dayNum} of Month</span>
                            {item.dayName && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.isWeekend ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              }`}>
                                {item.dayName} {item.isWeekend ? "(Wknd)" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {trajectoryMode === "cumulative" ? `Cumulative ${getMetricName()}` : `Daily ${getMetricName()}`}
                        </span>
                      </div>

                      {/* Actual Month Data Rows */}
                      <div className="space-y-1.5">
                        {availableMonths
                          .filter((m) => activeMonthKeys.includes(m.key))
                          .map((m, idx) => {
                            const colorMeta = MONTH_COLORS[idx % MONTH_COLORS.length];
                            const rawVal = item[m.key];
                            const dailyVal = item[`${m.key}_daily`];
                            const dealsVal = item[`${m.key}_deals`];

                            if (rawVal === undefined) {
                              return (
                                <div key={m.key} className="flex items-center justify-between text-zinc-500 text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: colorMeta.stroke }}
                                    ></span>
                                    <span>{m.label}:</span>
                                  </div>
                                  <span className="italic text-[10px]">Unlogged day</span>
                                </div>
                              );
                            }

                            return (
                              <div key={m.key} className="flex flex-col space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: colorMeta.stroke }}
                                    ></span>
                                    <span className="font-bold text-zinc-100">{m.label}</span>
                                    <span className="text-[10px] text-zinc-400 font-normal">
                                      ({m.relativeLabel})
                                    </span>
                                  </div>
                                  <span className="font-extrabold text-xs" style={{ color: colorMeta.stroke }}>
                                    {formatValue(rawVal)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-zinc-400 pl-3.5">
                                  <span>
                                    Day {dayNum}: {formatValue(dailyVal || 0)}
                                  </span>
                                  <span>{dealsVal || 0} deal{(dealsVal || 0) === 1 ? "" : "s"}</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={40}
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold pt-2 text-zinc-600">
                    {availableMonths
                      .filter((m) => activeMonthKeys.includes(m.key))
                      .map((m, idx) => {
                        const colorMeta = MONTH_COLORS[idx % MONTH_COLORS.length];
                        const isCurrentMonth = idx === 0;
                        return (
                          <div key={m.key} className="flex items-center gap-1.5">
                            <span
                              className="w-4 h-1.5 rounded-full"
                              style={{ backgroundColor: isCurrentMonth ? "#059669" : colorMeta.stroke }}
                            ></span>
                            <span className="text-zinc-800">
                              {m.label} {isCurrentMonth ? `(Actual Logged: Days 1–${currentLatestDay})` : ""}
                            </span>
                            <span className="text-zinc-400 font-normal">({m.relativeLabel})</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              />

              {/* Vertical Reference Line indicating Current Entry Boundary */}
              {!isCurrentMonthOver && currentLatestDay > 0 && currentMonth && activeMonthKeys.includes(currentMonth.key) && (
                <ReferenceLine
                  x={currentLatestDay === 0 ? "Start" : `Day ${currentLatestDay}`}
                  stroke="#059669"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              )}

              {/* Historical & Current Month Lines */}
              {availableMonths.map((m, idx) => {
                if (!activeMonthKeys.includes(m.key)) return null;
                const colorMeta = MONTH_COLORS[idx % MONTH_COLORS.length];
                const isCurrentMonth = idx === 0;

                return (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={isCurrentMonth ? `${m.label} (Actual: Days 1–${currentLatestDay})` : m.fullLabel}
                    stroke={isCurrentMonth ? "#059669" : colorMeta.stroke}
                    strokeWidth={isCurrentMonth ? 3.5 : idx === 1 ? 2.5 : 2.0}
                    dot={
                      isCurrentMonth
                        ? renderDataDot
                        : { r: 2.5, strokeWidth: 1, fill: colorMeta.stroke }
                    }
                    activeDot={{ r: 7, strokeWidth: 2.5, fill: "#ffffff", stroke: isCurrentMonth ? "#059669" : colorMeta.stroke }}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          ) : (
            /* Selected Date Range Chart */
            <LineChart
              data={rangeTimelineData.data}
              margin={{ top: 10, right: 15, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f4f4f5"
                vertical={false}
              />

              {/* Highlighted Anomaly Vertical Bands for Selected Range */}
              {showAnomalyBands &&
                activeRangeAnomalies.map((a) => {
                  const startIdx = rangeTimelineData.data.findIndex((d) => d.date >= a.startDate);
                  let endIdx = -1;
                  for (let i = rangeTimelineData.data.length - 1; i >= 0; i--) {
                    if (rangeTimelineData.data[i].date <= a.endDate) {
                      endIdx = i;
                      break;
                    }
                  }
                  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return null;
                  const startDisp = rangeTimelineData.data[startIdx]?.displayDate;
                  const endDisp = rangeTimelineData.data[endIdx]?.displayDate;
                  if (!startDisp || !endDisp) return null;

                  return (
                    <ReferenceArea
                      key={`range-area-${a.id}`}
                      x1={startDisp}
                      x2={endDisp}
                      fill="#fef3c7"
                      fillOpacity={0.2}
                      stroke="#f59e0b"
                      strokeOpacity={0.4}
                      strokeDasharray="3 3"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}
              {showAnomalyBands &&
                activeRangeAnomalies.map((a) => {
                  const startIdx = rangeTimelineData.data.findIndex((d) => d.date >= a.startDate);
                  if (startIdx === -1) return null;
                  const startDisp = rangeTimelineData.data[startIdx]?.displayDate;
                  if (!startDisp) return null;

                  return (
                    <ReferenceLine
                      key={`range-line-${a.id}`}
                      x={startDisp}
                      stroke="#f59e0b"
                      strokeWidth={1}
                      strokeOpacity={0.6}
                      strokeDasharray="3 3"
                      style={{ pointerEvents: "none" }}
                      label={{
                        value: `⚠️ ${a.anomaly.length > 20 ? a.anomaly.slice(0, 18) + "…" : a.anomaly}`,
                        position: "insideTopLeft",
                        fill: "#b45309",
                        fontSize: 9,
                        fontWeight: 600,
                        opacity: 0.85,
                      }}
                    />
                  );
                })}
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={{ stroke: "#e4e4e7" }}
                tick={{ fill: "#71717a", fontSize: 11 }}
                interval={Math.max(0, Math.floor(rangeTimelineData.data.length / 10))}
                dy={8}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "#e4e4e7" }}
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={formatAxisY}
                width={65}
              />
              <Tooltip
                wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;

                  return (
                    <div className="bg-zinc-900/95 backdrop-blur-xs text-white rounded-xl p-3 shadow-xl border border-zinc-800 text-xs min-w-[220px] max-w-[280px] space-y-2 pointer-events-none select-none">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                        <div>
                          <span className="font-bold text-zinc-100 text-sm">{item.fullDate}</span>
                          <span className="text-[10px] text-zinc-400 block">
                            Day {item.dayNumber} of range
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {trajectoryMode === "cumulative" ? `Cumulative ${getMetricName()}` : `Daily ${getMetricName()}`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="font-bold text-zinc-100">Selected Date</span>
                          </div>
                          <span className="font-extrabold text-xs text-emerald-400">
                            {formatValue(trajectoryMode === "cumulative" ? item.currentCumulative : item.currentDaily)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pl-3.5">
                          <span>
                            {item.actualDeals} deal{item.actualDeals === 1 ? "" : "s"} • {item.actualCalls} calls
                          </span>
                          <span>{formatINR(item.actualCommission)} comm</span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-zinc-800/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span className="text-zinc-300">
                              Prior ({item.prevFullDate})
                            </span>
                          </div>
                          <span className="font-bold text-xs text-indigo-400">
                            {formatValue(trajectoryMode === "cumulative" ? item.prevCumulative : item.prevDaily)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] pl-3.5">
                          <span className="text-zinc-400">Pace Variance:</span>
                          {(() => {
                            const cur = trajectoryMode === "cumulative" ? item.currentCumulative : item.currentDaily;
                            const prv = trajectoryMode === "cumulative" ? item.prevCumulative : item.prevDaily;
                            const diff = cur - prv;
                            return (
                              <span className={`font-bold ${diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {diff >= 0 ? "+" : ""}{formatValue(diff)}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-semibold pt-2 text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-zinc-900">
                        Selected Range ({formatDateDisplay(effectiveStartDate)} – {formatDateDisplay(effectiveEndDate)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span className="text-zinc-600">Prior Month Benchmark (Corresponding Days)</span>
                    </div>
                  </div>
                )}
              />

              <Line
                type="monotone"
                dataKey={trajectoryMode === "cumulative" ? "currentCumulative" : "currentDaily"}
                name="Selected Range"
                stroke="#10b981"
                strokeWidth={3.5}
                dot={renderDataDot}
                activeDot={{ r: 6, strokeWidth: 2, fill: "#ffffff", stroke: "#10b981" }}
              />

              <Line
                type="monotone"
                dataKey={trajectoryMode === "cumulative" ? "prevCumulative" : "prevDaily"}
                name="Prior Month Benchmark"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2, strokeWidth: 1, fill: "#6366f1" }}
                activeDot={{ r: 5, strokeWidth: 2, fill: "#ffffff", stroke: "#6366f1" }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Helpful Guidance Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            {chartScope === "monthlyBenchmark" ? (
              <>
                <strong>Default Multi-Month View:</strong> Comparing full calendar months across Days 1 to 31 (Day 1 to {currentLatestDay} verified actuals for {currentMonth?.label || "current month"}).
              </>
            ) : (
              <>
                <strong>Selected Date Range View:</strong> Showing progression from <strong>{formatDateDisplay(effectiveStartDate)}</strong> to <strong>{formatDateDisplay(effectiveEndDate)}</strong>.
              </>
            )}
          </span>
        </div>
        <span className="text-zinc-400 font-medium">
          {salesperson === "All" ? "Whole Team Performance" : `Executive: ${salesperson}`}
        </span>
      </div>
    </div>
  );
}
