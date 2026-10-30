import { PhoneCall, DollarSign, Award, ArrowRight } from "lucide-react";
import { CalculationSummary } from "../types";
import { formatINR } from "../utils/sheetParser";

interface CallYieldCardsProps {
  summary: CalculationSummary;
}

export function CallYieldCards({ summary }: CallYieldCardsProps) {
  const {
    numberOfCalls,
    dealAmount,
    aaCommission,
    revenuePerCall,
    aaCommissionPerCall,
    commissionPercentage,
    salesperson,
  } = summary;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Box 1: Revenue Generated per Call */}
      <div className="lg:col-span-6 bg-zinc-900 rounded-3xl p-7 sm:p-8 shadow-xl text-white relative overflow-hidden flex flex-col justify-between">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Revenue Generated per Call
              </h3>
            </div>
            {numberOfCalls > 0 && (
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30">
                Live Yield
              </span>
            )}
          </div>

          <div className="space-y-1 mb-8">
            {numberOfCalls > 0 ? (
              <p className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-white">
                {formatINR(revenuePerCall, 2)}
                <span className="text-lg sm:text-xl text-zinc-400 ml-2 font-normal">/ call</span>
              </p>
            ) : (
              <div>
                <p className="text-3xl sm:text-4xl font-light tracking-tight text-white">
                  {formatINR(0, 2)}
                  <span className="text-base text-zinc-400 ml-2 font-normal">/ call</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-zinc-800 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-400">Formula Breakdown</span>
            <span className="font-mono text-xs text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded">
              {numberOfCalls > 0
                ? `${formatINR(dealAmount)} ÷ ${numberOfCalls} calls`
                : `${formatINR(dealAmount)} ÷ [calls]`}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-400">Total Sales in Range</span>
            <span className="font-semibold text-emerald-400">{formatINR(dealAmount)}</span>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-zinc-800 rounded-full opacity-50 blur-3xl pointer-events-none"></div>
      </div>

      {/* Box 2: AA Commission per Call */}
      <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-3xl p-7 sm:p-8 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                AA Commission per Call
              </h3>
            </div>
            <span className="bg-zinc-100 text-zinc-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-zinc-200">
              {commissionPercentage.toFixed(2)}% Avg Rate
            </span>
          </div>

          <div className="space-y-1 mb-8">
            {numberOfCalls > 0 ? (
              <p className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-zinc-900">
                {formatINR(aaCommissionPerCall, 2)}
                <span className="text-lg sm:text-xl text-zinc-400 ml-2 font-normal">/ call</span>
              </p>
            ) : (
              <div>
                <p className="text-3xl sm:text-4xl font-light tracking-tight text-zinc-900">
                  {formatINR(0, 2)}
                  <span className="text-base text-zinc-400 ml-2 font-normal">/ call</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Formula Breakdown</span>
            <span className="font-mono text-xs text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded">
              {numberOfCalls > 0
                ? `${formatINR(aaCommission)} ÷ ${numberOfCalls} calls`
                : `${formatINR(aaCommission)} ÷ [calls]`}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Total Net Commission</span>
            <span className="font-semibold text-zinc-900">{formatINR(aaCommission)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
