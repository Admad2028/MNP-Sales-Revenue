import {
  DollarSign,
  Award,
  CheckCircle2,
  TrendingUp,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { CalculationSummary } from "../types";
import { formatINR, formatDateDisplay } from "../utils/sheetParser";

interface PrimaryMetricCardsProps {
  summary: CalculationSummary;
}

export function PrimaryMetricCards({ summary }: PrimaryMetricCardsProps) {
  const {
    salesperson,
    startDate,
    endDate,
    numberOfCalls,
    dealsClosed,
    dealAmount,
    aaCommission,
    averageDealAmount,
    commissionPercentage,
    conversionRate,
    callsPerDeal,
    matchingRecordsCount,
  } = summary;

  return (
    <div className="space-y-4">
      {/* Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
              Active Selection Overview
            </span>
            <h3 className="text-sm font-bold text-zinc-900">
              {salesperson === "All" ? "Whole Team" : salesperson}
              {startDate && endDate ? (
                <>
                  {" "}• {formatDateDisplay(startDate)} – {formatDateDisplay(endDate)}
                </>
              ) : (
                <span className="text-zinc-500 font-normal"> • All time logs</span>
              )}
              {numberOfCalls > 0 ? (
                <span className="text-emerald-700 font-bold ml-1.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {numberOfCalls} Calls Tracked
                </span>
              ) : null}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-medium">
            {matchingRecordsCount} matched log{matchingRecordsCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100">
            {dealsClosed} deal{dealsClosed === 1 ? "" : "s"} closed
          </span>
        </div>
      </div>

      {/* 4 Core Sales Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deal Amount */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Total Deal Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            {formatINR(dealAmount)}
          </div>
          <p className="text-xs text-zinc-500">
            Across {dealsClosed} logged deal{dealsClosed === 1 ? "" : "s"}
          </p>
        </div>

        {/* Total AA Commission */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Total Commission
            </span>
            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center border border-zinc-200">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            {formatINR(aaCommission)}
          </div>
          <p className="text-xs text-emerald-700 font-medium">
            {commissionPercentage.toFixed(2)}% avg commission rate
          </p>
        </div>

        {/* Closed Deals */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Closed Deals
            </span>
            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center border border-zinc-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            {dealsClosed}
          </div>
          <p className="text-xs text-zinc-500">
            {numberOfCalls > 0 && conversionRate > 0 ? (
              <span className="text-zinc-900 font-semibold">
                {conversionRate.toFixed(2)}% call conversion
              </span>
            ) : numberOfCalls === 0 ? (
              <span className="text-zinc-400">
                {dealsClosed > 0 ? `${dealsClosed} deals recorded` : "0 deals in date range"}
              </span>
            ) : (
              <span className="text-zinc-400">0% conversion ({dealsClosed} deals / {numberOfCalls} calls)</span>
            )}
          </p>
        </div>

        {/* Average Deal Value */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Avg Deal Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center border border-zinc-200">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            {formatINR(averageDealAmount)}
          </div>
          <p className="text-xs text-zinc-500">
            {dealsClosed > 0
              ? `${formatINR(dealAmount)} ÷ ${dealsClosed} deals`
              : "No deals recorded"}
          </p>
        </div>
      </div>
    </div>
  );
}
