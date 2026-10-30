import { useMemo, useState } from "react";
import { SheetRecord, AnomalyRecord } from "../types";
import { formatINR, formatDateDisplay, getDefaultDateRange, getDatesInRange } from "../utils/sheetParser";
import { BarChart3, Calendar, AlertTriangle } from "lucide-react";

interface VisualChartProps {
  records: SheetRecord[];
  salesperson: string;
  startDate: string;
  endDate: string;
  anomalies?: AnomalyRecord[];
}

export function VisualChart({
  records,
  salesperson,
  startDate,
  endDate,
  anomalies = [],
}: VisualChartProps) {
  const [metricView, setMetricView] = useState<"dealAmount" | "aaCommission" | "dealsClosed">("dealAmount");

  // Determine effective date bounds (defaults to 1st of current month to today if empty)
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

  // Filter anomalies relevant to active date range and salesperson
  const activeAnomalies = useMemo(() => {
    if (!anomalies || anomalies.length === 0 || !effectiveStartDate || !effectiveEndDate) return [];
    return anomalies.filter((a) => {
      if (!isRepAffected(a.affected, salesperson)) return false;
      return a.startDate <= effectiveEndDate && a.endDate >= effectiveStartDate;
    });
  }, [anomalies, effectiveStartDate, effectiveEndDate, salesperson]);

  // Generate consecutive calendar days strictly across the selected date range
  const dailyData = useMemo(() => {
    const dateList = getDatesInRange(effectiveStartDate, effectiveEndDate);

    const recordMap: Record<
      string,
      { dealAmount: number; aaCommission: number; dealsClosed: number; genuineCalls: number }
    > = {};

    records.forEach((r) => {
      if (salesperson !== "All" && r.executive.toLowerCase() !== salesperson.toLowerCase()) return;
      if (effectiveStartDate && r.date < effectiveStartDate) return;
      if (effectiveEndDate && r.date > effectiveEndDate) return;

      if (!recordMap[r.date]) {
        recordMap[r.date] = {
          dealAmount: 0,
          aaCommission: 0,
          dealsClosed: 0,
          genuineCalls: 0,
        };
      }
      recordMap[r.date].dealAmount += r.dealAmount;
      recordMap[r.date].aaCommission += r.aaCommission;
      recordMap[r.date].dealsClosed += r.dealsClosed;
      recordMap[r.date].genuineCalls += r.genuineCalls;
    });

    return dateList.map((dStr) => {
      const stats = recordMap[dStr] || {
        dealAmount: 0,
        aaCommission: 0,
        dealsClosed: 0,
        genuineCalls: 0,
      };
      const matchingAnomaly = activeAnomalies.find((a) => a.startDate <= dStr && dStr <= a.endDate);
      return {
        date: dStr,
        anomaly: matchingAnomaly,
        ...stats,
      };
    });
  }, [records, salesperson, effectiveStartDate, effectiveEndDate, activeAnomalies]);

  const maxVal = useMemo(() => {
    const vals = dailyData.map((d) => d[metricView]);
    const max = Math.max(...vals, 0);
    return max > 0 ? max : 10;
  }, [dailyData, metricView]);

  const totalInPeriod = useMemo(() => {
    return dailyData.reduce(
      (acc, d) => ({
        dealAmount: acc.dealAmount + d.dealAmount,
        aaCommission: acc.aaCommission + d.aaCommission,
        dealsClosed: acc.dealsClosed + d.dealsClosed,
      }),
      { dealAmount: 0, aaCommission: 0, dealsClosed: 0 }
    );
  }, [dailyData]);

  if (dailyData.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm text-center text-zinc-500 py-12">
        <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
        <p className="text-sm font-medium">No dates selected in date range.</p>
      </div>
    );
  }

  const isSingleDay = dailyData.length === 1;

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900">
                Daily Performance Timeline
              </h3>
            </div>
            <p className="text-xs text-zinc-500">
              {salesperson === "All" ? "Whole Team" : salesperson} •{" "}
              {isSingleDay ? (
                <span>Single Day: <strong>{formatDateDisplay(effectiveStartDate)}</strong></span>
              ) : (
                <span>
                  <strong>{formatDateDisplay(effectiveStartDate)}</strong> to{" "}
                  <strong>{formatDateDisplay(effectiveEndDate)}</strong> ({dailyData.length} days)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50 text-xs">
          <button
            type="button"
            onClick={() => setMetricView("dealAmount")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              metricView === "dealAmount"
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Deal Amount (₹)
          </button>
          <button
            type="button"
            onClick={() => setMetricView("aaCommission")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              metricView === "aaCommission"
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            AA Commission (₹)
          </button>
          <button
            type="button"
            onClick={() => setMetricView("dealsClosed")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              metricView === "dealsClosed"
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Deals Count
          </button>
        </div>
      </div>

      {/* Operational Anomalies Notification Banner */}
      {activeAnomalies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Operational Anomaly Logged:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeAnomalies.map((anom) => {
              // Extract human readable month e.g. "September 2026"
              const monthName = (() => {
                try {
                  const [y, m] = anom.startDate.slice(0, 7).split("-");
                  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
                } catch {
                  return "";
                }
              })();
              return (
                <div
                  key={anom.id}
                  className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 bg-white/95 border border-amber-300 rounded-xl text-amber-900 font-medium shadow-xs"
                >
                  {monthName && (
                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-bold rounded text-[10px] uppercase tracking-wide">
                      {monthName}
                    </span>
                  )}
                  <span className="font-bold text-amber-900">{anom.anomaly}</span>
                  <span className="text-amber-700">
                    ({anom.rawStartDate}
                    {anom.rawEndDate && anom.rawEndDate !== anom.rawStartDate ? ` to ${anom.rawEndDate}` : ""})
                  </span>
                  {anom.remarks && <span className="text-zinc-500">• Reason: {anom.remarks}</span>}
                  <span className="text-zinc-500">• Affected: {anom.affected}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline Visual Area */}
      <div className="pt-2">
        {isSingleDay ? (
          /* Single Day Detailed View */
          <div className="space-y-3">
            {dailyData[0]?.anomaly && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">
                    Operational Anomaly on this date: {dailyData[0].anomaly.anomaly}
                  </div>
                  {dailyData[0].anomaly.remarks && (
                    <div className="text-zinc-600 mt-0.5">Reason: {dailyData[0].anomaly.remarks}</div>
                  )}
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    Affected: {dailyData[0].anomaly.affected}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                  Selected Day Performance
                </span>
                <p className="text-lg font-bold text-zinc-900 mt-0.5">
                  {formatDateDisplay(dailyData[0].date)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-center sm:text-right">
                <div className="bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-xs">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Deal Sales</span>
                  <span className="text-base font-extrabold text-zinc-900">
                    {formatINR(dailyData[0].dealAmount)}
                  </span>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-xs">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Commission</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatINR(dailyData[0].aaCommission)}
                  </span>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-xs">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Deals Closed</span>
                  <span className="text-base font-extrabold text-zinc-900">
                    {dailyData[0].dealsClosed}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Day Timeline Bar Chart */
          <div>
            <div className="h-60 w-full flex items-end gap-1 sm:gap-2 pt-8 pb-2 border-b border-zinc-100">
              {dailyData.map((d) => {
                const val = d[metricView];
                const heightPct = val === 0 ? 4 : Math.max(8, (val / maxVal) * 100);
                const dateParts = d.date.split("-");
                const dayOfMonth = dateParts[2];
                const month = dateParts[1];

                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[14px]"
                  >
                    {/* Floating Tooltip */}
                    <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center z-30 pointer-events-none max-w-xs">
                      <div className="bg-zinc-900 text-white text-xs rounded-xl py-2.5 px-3.5 shadow-xl whitespace-nowrap text-center border border-zinc-800">
                        <span className="font-semibold text-zinc-300 block">
                          {formatDateDisplay(d.date)}
                        </span>
                        <span className="font-bold text-emerald-400 block mt-0.5">
                          Revenue: {formatINR(d.dealAmount)}
                        </span>
                        <span className="text-zinc-200 block text-[11px]">
                          Commission: {formatINR(d.aaCommission)}
                        </span>
                        <span className="text-zinc-400 block text-[11px]">
                          Deals: {d.dealsClosed}
                        </span>
                      </div>
                      <div className="w-2 h-2 bg-zinc-900 transform rotate-45 -mt-1"></div>
                    </div>

                    {/* Anomaly Indicator Icon Above Bar */}
                    {d.anomaly && (
                      <span
                        className="text-[10px] text-amber-600 font-semibold mb-0.5 select-none opacity-80"
                        title={`Operational Anomaly: ${d.anomaly.anomaly} (${d.anomaly.remarks || "No remarks"})`}
                      >
                        ⚠️
                      </span>
                    )}

                    {/* The Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        d.anomaly
                          ? "bg-amber-500 ring-2 ring-amber-400/60 group-hover:bg-amber-600"
                          : val === 0
                          ? "bg-zinc-200 group-hover:bg-zinc-300"
                          : metricView === "dealAmount"
                          ? "bg-zinc-900 group-hover:bg-zinc-800"
                          : metricView === "aaCommission"
                          ? "bg-emerald-600 group-hover:bg-emerald-500"
                          : "bg-zinc-700 group-hover:bg-zinc-600"
                      }`}
                    ></div>

                    {/* Date label */}
                    <span className={`text-[10px] font-semibold mt-2 truncate w-full text-center ${d.anomaly ? "text-amber-700 font-bold" : "text-zinc-400"}`}>
                      {dayOfMonth}/{month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
