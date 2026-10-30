import jsPDF from "jspdf";
import { SheetRecord } from "../types";
import { parseMovementType } from "./calculations";
import { getISTDateString, parseDateToISO } from "./sheetParser";

export interface MonthDataPoint {
  day: number;
  sales: number;
  cumulativeSales: number;
  deals: number;
  cumulativeDeals: number;
  commission: number;
  cumulativeCommission: number;
}

export interface MonthSummary {
  key: string; // "2026-09"
  label: string; // "Sep 2026"
  fullLabel: string; // "September 2026"
  totalDays: number;
  maxDayLogged: number;
  totalSales: number;
  totalDeals: number;
  totalCommission: number;
  mtdSales: number;
  mtdDeals: number;
  mtdCommission: number;
  dailyAvgSales: number;
  dailyAvgDeals: number;
  dailyAvgCommission: number;
  projectedSales: number;
  projectedDeals: number;
  projectedCommission: number;
  days: MonthDataPoint[];
}

/**
 * Extracts and groups month-by-month trajectory data for a salesperson or whole team
 */
export function extractMonthlyData(
  records: SheetRecord[],
  salesperson: string
): {
  currentMonth: MonthSummary | null;
  prevMonth: MonthSummary | null;
  prior2Month: MonthSummary | null;
  allMonths: MonthSummary[];
} {
  const filtered = records.filter((r) => {
    if (salesperson !== "All" && r.executive.toLowerCase() !== salesperson.toLowerCase()) {
      return false;
    }
    return true;
  });

  const todayIST = getISTDateString(0);
  const activeCurrentMonthKey = todayIST.substring(0, 7);

  const monthKeysSet = new Set<string>();
  monthKeysSet.add(activeCurrentMonthKey);

  filtered.forEach((r) => {
    if (r.date && r.date.length >= 7) {
      monthKeysSet.add(r.date.substring(0, 7));
    }
  });

  const sortedKeys = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));
  if (sortedKeys.length === 0) {
    return { currentMonth: null, prevMonth: null, prior2Month: null, allMonths: [] };
  }

  const allMonths: MonthSummary[] = sortedKeys.map((mKey, idx) => {
    const [yearStr, monthStr] = mKey.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const totalDays = new Date(year, monthNum, 0).getDate();

    const tempDate = new Date(year, monthNum - 1, 1);
    const label = `${tempDate.toLocaleString("en-US", { month: "short" })} ${year}`;
    const fullLabel = `${tempDate.toLocaleString("en-US", { month: "long" })} ${year}`;

    const dailySales: number[] = new Array(32).fill(0);
    const dailyDeals: number[] = new Array(32).fill(0);
    const dailyCommission: number[] = new Array(32).fill(0);
    let maxDayLogged = 0;
    let hasEntries = false;

    filtered.forEach((r) => {
      if (r.date.startsWith(mKey)) {
        const day = parseInt(r.date.substring(8, 10), 10);
        if (day >= 1 && day <= 31) {
          dailySales[day] += r.dealAmount;
          dailyDeals[day] += r.dealsClosed;
          dailyCommission[day] += r.aaCommission;
          hasEntries = true;
          if (day > maxDayLogged) {
            maxDayLogged = day;
          }
        }
      }
    });

    const isCurrentMonth = mKey === activeCurrentMonthKey;
    const effectiveMaxDay = isCurrentMonth
      ? (hasEntries ? maxDayLogged : Math.max(1, parseInt(todayIST.substring(8, 10), 10) || 1))
      : Math.max(maxDayLogged, totalDays);

    const days: MonthDataPoint[] = [];
    let runningSales = 0;
    let runningDeals = 0;
    let runningCommission = 0;

    for (let d = 1; d <= 31; d++) {
      runningSales += dailySales[d];
      runningDeals += dailyDeals[d];
      runningCommission += dailyCommission[d];

      days.push({
        day: d,
        sales: dailySales[d],
        cumulativeSales: runningSales,
        deals: dailyDeals[d],
        cumulativeDeals: runningDeals,
        commission: dailyCommission[d],
        cumulativeCommission: runningCommission,
      });
    }

    const elapsedDays = Math.max(1, effectiveMaxDay);
    const mtdSales = days[Math.min(elapsedDays, 31) - 1]?.cumulativeSales || runningSales;
    const mtdDeals = days[Math.min(elapsedDays, 31) - 1]?.cumulativeDeals || runningDeals;
    const mtdCommission = days[Math.min(elapsedDays, 31) - 1]?.cumulativeCommission || runningCommission;

    let dailyAvgSales = mtdSales / elapsedDays;
    let dailyAvgDeals = mtdDeals / elapsedDays;
    let dailyAvgCommission = mtdCommission / elapsedDays;

    const isMonthComplete = !isCurrentMonth || effectiveMaxDay >= totalDays;
    let projectedSales = isMonthComplete ? mtdSales : Math.round(dailyAvgSales * totalDays);
    let projectedDeals = isMonthComplete ? mtdDeals : Math.round(dailyAvgDeals * totalDays);
    let projectedCommission = isMonthComplete ? mtdCommission : Math.round(dailyAvgCommission * totalDays);

    return {
      key: mKey,
      label,
      fullLabel,
      totalDays,
      maxDayLogged: effectiveMaxDay,
      totalSales: runningSales,
      totalDeals: runningDeals,
      totalCommission: runningCommission,
      mtdSales,
      mtdDeals,
      mtdCommission,
      dailyAvgSales,
      dailyAvgDeals,
      dailyAvgCommission,
      projectedSales,
      projectedDeals,
      projectedCommission,
      days,
    };
  });

  // If current month has 0 entries yet, anchor its projections to previous month
  const curr = allMonths[0];
  const prev = allMonths[1];
  if (curr && prev && curr.mtdSales === 0 && prev.totalSales > 0) {
    curr.dailyAvgSales = prev.totalSales / prev.totalDays;
    curr.dailyAvgDeals = prev.totalDeals / prev.totalDays;
    curr.dailyAvgCommission = prev.totalCommission / prev.totalDays;
    curr.projectedSales = Math.round(curr.dailyAvgSales * curr.totalDays);
    curr.projectedDeals = Math.round(curr.dailyAvgDeals * curr.totalDays);
    curr.projectedCommission = Math.round(curr.dailyAvgCommission * curr.totalDays);
  }

  return {
    currentMonth: allMonths[0] || null,
    prevMonth: allMonths[1] || null,
    prior2Month: allMonths[2] || null,
    allMonths,
  };
}

/**
 * Formats numbers compactly for PDF charts (e.g. Rs. 12.5L, Rs. 50k, 70 deals)
 */
export function formatPdfCompactINR(val: number): string {
  if (val >= 10000000) return `Rs. ${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `Rs. ${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `Rs. ${(val / 1000).toFixed(0)}k`;
  return `Rs. ${Math.round(val).toLocaleString("en-IN")}`;
}

export function formatPdfCompactNumber(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return `${Math.round(val)}`;
}

function getNiceMax(val: number, isCount = false): number {
  if (val <= 0) return isCount ? 10 : 100000;
  const target = val * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const normalized = target / magnitude;
  let niceNorm = 10;
  if (normalized <= 1.2) niceNorm = 1.2;
  else if (normalized <= 1.5) niceNorm = 1.5;
  else if (normalized <= 2) niceNorm = 2;
  else if (normalized <= 2.5) niceNorm = 2.5;
  else if (normalized <= 5) niceNorm = 5;
  else if (normalized <= 7.5) niceNorm = 7.5;
  else niceNorm = 10;
  return niceNorm * magnitude;
}

export interface DrawLineChartOptions {
  doc: jsPDF;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  metricType: "sales" | "deals" | "commission";
  records: SheetRecord[];
  salesperson: string;
}

/**
 * Draws a high-definition vector line chart with MTD trajectory, previous month benchmark,
 * projected pace, gridlines, axis labels, callout badges directly on jsPDF.
 */
export function drawMonthlyTrajectoryChart({
  doc,
  x,
  y,
  width,
  height,
  title,
  subtitle,
  metricType,
  records,
  salesperson,
}: DrawLineChartOptions): void {
  const { currentMonth, prevMonth, prior2Month } = extractMonthlyData(records, salesperson);
  if (!currentMonth) return;

  const isSales = metricType === "sales";
  const isDeals = metricType === "deals";
  const isCommission = metricType === "commission";

  // Primary Theme Color based on Metric Type
  const themeColor: [number, number, number] = isSales
    ? [16, 185, 129] // Emerald
    : isCommission
    ? [14, 165, 233] // Sky blue / Teal
    : [99, 102, 241]; // Indigo

  // 1. Draw Container Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(228, 228, 231); // zinc-200
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, "FD");

  // Top header accent line
  doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.rect(x, y, width, 1.2, "F");

  // 2. Chart Header: Title & Subtitle
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27); // zinc-900
  doc.text(title, x + 6, y + 8.5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(113, 113, 122); // zinc-500
  doc.text(subtitle, x + 6, y + 13.5);

  // 3. Legend (Top Right)
  const legendRightX = x + width - 6;
  const legendY = y + 8.5;

  // Swatch 1: Current Month (Solid Theme)
  doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.circle(legendRightX - 118, legendY - 1, 1.2, "F");
  doc.setFontSize(6.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(39, 39, 42);
  doc.text(`${currentMonth.label}`, legendRightX - 114, legendY);

  // Swatch 2: Projected Pace (Dashed Theme)
  doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.setLineWidth(0.6);
  (doc as any).setLineDashPattern?.([1.5, 1.2], 0);
  doc.line(legendRightX - 86, legendY - 1, legendRightX - 78, legendY - 1);
  (doc as any).setLineDashPattern?.([], 0);
  doc.setFont("helvetica", "bold");
  doc.text("Projected", legendRightX - 75, legendY);

  // Swatch 3: Prev Month (Indigo Solid)
  if (prevMonth) {
    doc.setFillColor(99, 102, 241);
    doc.circle(legendRightX - 48, legendY - 1, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${prevMonth.label}`, legendRightX - 44, legendY);
  }

  // Swatch 4: 2 Mo Prior (Amber Solid)
  if (prior2Month) {
    doc.setFillColor(245, 158, 11);
    doc.circle(legendRightX - 18, legendY - 1, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${prior2Month.label}`, legendRightX - 14, legendY);
  }

  // 4. Plot Area Dimensions
  const plotLeft = x + 24;
  const plotTop = y + 18;
  const plotWidth = width - 36;
  const plotHeight = height - 32;
  const plotBottom = plotTop + plotHeight;
  const plotRight = plotLeft + plotWidth;

  // Extract relevant values per day
  const getVal = (d: MonthDataPoint, m: MonthSummary | null) => {
    if (!m) return 0;
    if (isSales) return d.cumulativeSales;
    if (isDeals) return d.cumulativeDeals;
    return d.cumulativeCommission;
  };

  const curMtdVal = isSales ? currentMonth.mtdSales : isDeals ? currentMonth.mtdDeals : currentMonth.mtdCommission;
  const curProjVal = isSales ? currentMonth.projectedSales : isDeals ? currentMonth.projectedDeals : currentMonth.projectedCommission;
  const prevTotalVal = prevMonth ? (isSales ? prevMonth.totalSales : isDeals ? prevMonth.totalDeals : prevMonth.totalCommission) : 0;
  const prior2TotalVal = prior2Month ? (isSales ? prior2Month.totalSales : isDeals ? prior2Month.totalDeals : prior2Month.totalCommission) : 0;

  // Calculate Y-axis Scale
  const rawMax = Math.max(curProjVal, curMtdVal, prevTotalVal, prior2TotalVal, 1);
  const yMax = getNiceMax(rawMax, isDeals);

  const getX = (dayNum: number) => plotLeft + ((dayNum - 1) / 30) * plotWidth;
  const getY = (val: number) => plotBottom - (Math.min(Math.max(val, 0), yMax) / yMax) * plotHeight;

  // 5. Grid Lines & Axis Ticks
  const numGridLines = 4;
  doc.setLineWidth(0.2);

  for (let i = 0; i <= numGridLines; i++) {
    const fraction = i / numGridLines;
    const gridVal = fraction * yMax;
    const gy = plotBottom - fraction * plotHeight;

    // Horizontal grid line
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(plotLeft, gy, plotRight, gy);

    // Y-axis Label
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    const labelStr = isDeals ? `${Math.round(gridVal)}` : formatPdfCompactINR(gridVal);
    doc.text(labelStr, plotLeft - 2.5, gy + 1.2, { align: "right" });
  }

  // X-axis Day Ticks: Days 1, 5, 10, 15, 20, 25, 31
  const xTickDays = [1, 5, 10, 15, 20, 25, 31];
  xTickDays.forEach((dayNum) => {
    const gx = getX(dayNum);

    // Subtle vertical grid line
    doc.setDrawColor(248, 250, 252);
    doc.line(gx, plotTop, gx, plotBottom);

    // Tick label
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`D${dayNum}`, gx, plotBottom + 3.8, { align: "center" });
  });

  // Base X-axis Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.line(plotLeft, plotBottom, plotRight, plotBottom);

  // 6. Draw 2 Months Prior Curve (Amber #f59e0b)
  if (prior2Month && prior2Month.days.length > 0) {
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.4);
    (doc as any).setLineDashPattern?.([], 0);

    for (let d = 1; d < 31; d++) {
      const p1 = prior2Month.days[d - 1];
      const p2 = prior2Month.days[d];
      if (p1 && p2) {
        const x1 = getX(p1.day);
        const y1 = getY(getVal(p1, prior2Month));
        const x2 = getX(p2.day);
        const y2 = getY(getVal(p2, prior2Month));
        doc.line(x1, y1, x2, y2);
      }
    }
    const lastPoint = prior2Month.days[30];
    if (lastPoint) {
      doc.setFillColor(245, 158, 11);
      doc.circle(getX(31), getY(getVal(lastPoint, prior2Month)), 0.9, "F");
    }
  }

  // 7. Draw Previous Month Curve (Indigo #6366f1)
  if (prevMonth && prevMonth.days.length > 0) {
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    (doc as any).setLineDashPattern?.([], 0);

    for (let d = 1; d < 31; d++) {
      const p1 = prevMonth.days[d - 1];
      const p2 = prevMonth.days[d];
      if (p1 && p2) {
        const x1 = getX(p1.day);
        const y1 = getY(getVal(p1, prevMonth));
        const x2 = getX(p2.day);
        const y2 = getY(getVal(p2, prevMonth));
        doc.line(x1, y1, x2, y2);
      }
    }

    // Prev month endpoint marker
    const lastPrevPoint = prevMonth.days[30];
    if (lastPrevPoint) {
      const px = getX(31);
      const py = getY(getVal(lastPrevPoint, prevMonth));
      doc.setFillColor(99, 102, 241);
      doc.circle(px, py, 1.2, "F");
    }
  }

  // 8. Draw Current Month MTD Solid Curve
  const maxDay = Math.min(currentMonth.maxDayLogged, 31);
  doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.setLineWidth(0.9);
  (doc as any).setLineDashPattern?.([], 0);

  // Baseline from Day 0 to Day 1
  if (maxDay >= 1 && currentMonth.days[0]) {
    doc.line(getX(0), getY(0), getX(1), getY(getVal(currentMonth.days[0], currentMonth)));
  }

  for (let d = 1; d < maxDay; d++) {
    const p1 = currentMonth.days[d - 1];
    const p2 = currentMonth.days[d];
    if (p1 && p2) {
      const x1 = getX(p1.day);
      const y1 = getY(getVal(p1, currentMonth));
      const x2 = getX(p2.day);
      const y2 = getY(getVal(p2, currentMonth));
      doc.line(x1, y1, x2, y2);
    }
  }

  // Current Month Data Points (Small Dots on Logged Days)
  for (let d = 1; d <= maxDay; d++) {
    const p = currentMonth.days[d - 1];
    if (p) {
      const px = getX(p.day);
      const py = getY(getVal(p, currentMonth));
      doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
      doc.circle(px, py, 0.8, "F");
    }
  }

  // 8. Draw Projected Trajectory Dashed Line (only after Day 15 of the month)
  if (maxDay >= 15 && maxDay < 31) {
    const startX = getX(maxDay);
    const startY = getY(curMtdVal);
    const endX = getX(31);
    const endY = getY(curProjVal);

    doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setLineWidth(0.7);
    (doc as any).setLineDashPattern?.([1.5, 1.2], 0);
    doc.line(startX, startY, endX, endY);
    (doc as any).setLineDashPattern?.([], 0);

    // Projected Endpoint Hollow Circle
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.circle(endX, endY, 1.4, "FD");
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.circle(endX, endY, 0.6, "F");
  }

  // 9. Callout Badges / Milestone Tags
  // MTD Badge at Day maxDay
  const mtdBadgeX = getX(maxDay);
  const mtdBadgeY = getY(curMtdVal);
  const mtdText = isDeals
    ? `Day ${maxDay}: ${curMtdVal} deals`
    : `Day ${maxDay}: ${formatPdfCompactINR(curMtdVal)}`;

  doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
  const mtdTagW = doc.getTextWidth(mtdText) + 4;
  doc.roundedRect(
    Math.min(mtdBadgeX - mtdTagW / 2, plotRight - mtdTagW),
    Math.max(mtdBadgeY - 6.5, plotTop),
    mtdTagW,
    4.2,
    1,
    1,
    "F"
  );
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(
    mtdText,
    Math.min(mtdBadgeX - mtdTagW / 2, plotRight - mtdTagW) + 2,
    Math.max(mtdBadgeY - 6.5, plotTop) + 3
  );

  // Projected Month-End Badge at Day 31 (if month in progress and after Day 15)
  if (maxDay >= 15 && maxDay < 31) {
    const projText = isDeals
      ? `Proj: ${curProjVal} deals`
      : `Proj: ${formatPdfCompactINR(curProjVal)}`;
    doc.setFillColor(24, 24, 27);
    const projTagW = doc.getTextWidth(projText) + 4;
    doc.roundedRect(plotRight - projTagW, Math.max(getY(curProjVal) - 6.5, plotTop), projTagW, 4.2, 1, 1, "F");
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(isCommission ? 56 : 52, isCommission ? 189 : 211, isCommission ? 248 : 153);
    doc.text(projText, plotRight - projTagW + 2, Math.max(getY(curProjVal) - 6.5, plotTop) + 3);
  }

  // 10. Bottom Summary Callout Banner inside Chart Box
  const bannerY = plotBottom + 5.5;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(241, 245, 249);
  doc.roundedRect(x + 5, bannerY, width - 10, 5.5, 1, 1, "FD");

  const dailyAvgStr = isDeals
    ? `${currentMonth.dailyAvgDeals.toFixed(1)} deals/day`
    : isCommission
    ? `${formatPdfCompactINR(currentMonth.dailyAvgCommission)}/day`
    : `${formatPdfCompactINR(currentMonth.dailyAvgSales)}/day`;

  const momGrowth = prevTotalVal > 0 ? ((curProjVal - prevTotalVal) / prevTotalVal) * 100 : 0;
  const momGrowthStr = `${momGrowth >= 0 ? "+" : ""}${momGrowth.toFixed(1)}% vs ${prevMonth?.label || "Prior"}`;

  const summaryText = maxDay >= 15
    ? `Run-Rate: ${dailyAvgStr}  |  Projected MoM Trajectory: ${momGrowthStr}  |  ${Math.max(0, currentMonth.totalDays - maxDay)} days remaining`
    : `Actual Logged: Days 1–${maxDay}  |  Run-Rate: ${dailyAvgStr}  |  Predictor activates after Day 15 (${Math.max(0, 15 - maxDay)} days to unlock)`;

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(
    summaryText,
    x + 8,
    bannerY + 3.8
  );
}
