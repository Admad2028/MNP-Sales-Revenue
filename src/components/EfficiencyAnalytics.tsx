import { useState } from "react";
import {
  TrendingUp,
  Target,
  Calculator,
  Compass,
  ArrowRight,
  Sparkles,
  Layers,
  PieChart,
  Sliders
} from "lucide-react";
import { CalculationSummary } from "../types";
import { formatINR } from "../utils/sheetParser";

interface EfficiencyAnalyticsProps {
  summary: CalculationSummary;
}

export function EfficiencyAnalytics({ summary }: EfficiencyAnalyticsProps) {
  const {
    revenuePerCall,
    aaCommissionPerCall,
    conversionRate,
    callsPerDeal,
    averageDealAmount,
    movementBreakdown,
  } = summary;

  // Simulator target state
  const [targetRevenue, setTargetRevenue] = useState<number>(200000);
  const [targetCommission, setTargetCommission] = useState<number>(15000);
  const [simulatedCalls, setSimulatedCalls] = useState<number>(150);

  // Projected outcomes
  const callsNeededForRevenue =
    revenuePerCall > 0 ? Math.ceil(targetRevenue / revenuePerCall) : 0;
  const callsNeededForCommission =
    aaCommissionPerCall > 0 ? Math.ceil(targetCommission / aaCommissionPerCall) : 0;

  const simulatedTotalRevenue = simulatedCalls * revenuePerCall;
  const simulatedTotalCommission = simulatedCalls * aaCommissionPerCall;
  const simulatedDeals =
    callsPerDeal > 0 ? (simulatedCalls / callsPerDeal).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 6 cols: Call Economics & Breakdown (White Bento Card) */}
      <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-zinc-900">
                Call Economics & Conversion
              </h3>
            </div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              CONVERSION METRICS
            </span>
          </div>

          {/* 4 Metric Tiles */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">
                Call-to-Deal Conversion
              </span>
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1 block tracking-tight">
                {summary.numberOfCalls > 0 ? `${conversionRate.toFixed(2)}%` : "—"}
              </span>
              <span className="text-xs text-zinc-400 mt-0.5 block">
                {summary.numberOfCalls > 0 && conversionRate > 0
                  ? `${conversionRate.toFixed(1)} deals / 100 calls`
                  : summary.numberOfCalls === 0
                  ? "Enter calls to calculate"
                  : "0 deals logged"}
              </span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">
                Calls Required Per Deal
              </span>
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1 block tracking-tight">
                {callsPerDeal > 0 ? `${callsPerDeal.toFixed(1)} calls` : "N/A"}
              </span>
              <span className="text-xs text-zinc-400 mt-0.5 block">
                Average call effort
              </span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">
                Revenue Yield / 50 Calls
              </span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 block tracking-tight">
                {formatINR(revenuePerCall * 50)}
              </span>
              <span className="text-xs text-zinc-400 mt-0.5 block">
                50 × {formatINR(revenuePerCall, 2)}
              </span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider block">
                Comm. Yield / 50 Calls
              </span>
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1 block tracking-tight">
                {formatINR(aaCommissionPerCall * 50)}
              </span>
              <span className="text-xs text-zinc-400 mt-0.5 block">
                50 × {formatINR(aaCommissionPerCall, 2)}
              </span>
            </div>
          </div>
        </div>

        {/* Movement Breakdown (Intracity vs Intercity Deals Only) */}
        <div className="pt-4 border-t border-zinc-100 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-700" />
              Movement Type Distribution
            </span>
            <span className="font-mono text-zinc-500 font-bold">
              {summary.movementDistribution?.totalMovementDeals || 0} Total Deals
            </span>
          </div>

          {!summary.movementDistribution || summary.movementDistribution.totalMovementDeals === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2">
              No movement type deals recorded in this selection.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Intracity Deals Tile */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">
                      Intracity
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-600 bg-zinc-200/70 px-2 py-0.5 rounded-md font-mono">
                      {summary.movementDistribution.intracityPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                    <span className="text-2xl font-bold text-zinc-900 tracking-tight font-mono">
                      {summary.movementDistribution.intracityDeals}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      deal{summary.movementDistribution.intracityDeals === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block truncate">
                    Local 1, 2, 3 movements
                  </span>
                </div>

                {/* Intercity Deals Tile */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">
                      Intercity
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-600 bg-zinc-200/70 px-2 py-0.5 rounded-md font-mono">
                      {summary.movementDistribution.intercityPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                    <span className="text-2xl font-bold text-zinc-900 tracking-tight font-mono">
                      {summary.movementDistribution.intercityDeals}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      deal{summary.movementDistribution.intercityDeals === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block truncate">
                    Intercity 1, 2, 3 movements
                  </span>
                </div>
              </div>

              {/* Proportional Distribution Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${summary.movementDistribution.intracityPercentage}%` }}
                    className="h-full bg-zinc-800 transition-all duration-300"
                    title={`Intracity: ${summary.movementDistribution.intracityDeals} deals (${summary.movementDistribution.intracityPercentage.toFixed(1)}%)`}
                  />
                  <div
                    style={{ width: `${summary.movementDistribution.intercityPercentage}%` }}
                    className="h-full bg-zinc-400 transition-all duration-300"
                    title={`Intercity: ${summary.movementDistribution.intercityDeals} deals (${summary.movementDistribution.intercityPercentage.toFixed(1)}%)`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zinc-800 inline-block"></span>
                    Intracity ({summary.movementDistribution.intracityDeals})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zinc-400 inline-block"></span>
                    Intercity ({summary.movementDistribution.intercityDeals})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right 6 cols: Interactive Projections & Target Planner (Dark Bento Box) */}
      <div className="lg:col-span-6 bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-xl text-white relative overflow-hidden space-y-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-white">
                <Calculator className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Call Volume & Target Simulator
                </h3>
                <p className="text-xs text-zinc-400">
                  Forecast revenue based on current call efficiency
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              PROJECTIONS
            </span>
          </div>

          {/* Interactive Slider for simulated call count */}
          <div className="p-4 bg-zinc-800/80 border border-zinc-700/60 rounded-2xl space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Simulated Call Volume:
              </label>
              <span className="text-sm font-bold text-white font-mono bg-zinc-700 px-3 py-1 rounded-xl border border-zinc-600">
                {simulatedCalls} calls
              </span>
            </div>

            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={simulatedCalls}
              onChange={(e) => setSimulatedCalls(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />

            <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
              <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                  Proj. Revenue
                </span>
                <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                  {formatINR(simulatedTotalRevenue)}
                </span>
              </div>
              <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                  Proj. Commission
                </span>
                <span className="text-sm font-bold text-white block mt-0.5">
                  {formatINR(simulatedTotalCommission)}
                </span>
              </div>
              <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                  Est. Deals
                </span>
                <span className="text-sm font-bold text-amber-300 block mt-0.5">
                  ~{simulatedDeals}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Goal Planner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10 pt-2">
          {/* Revenue Target Goal */}
          <div className="p-4 bg-zinc-800/80 border border-zinc-700/60 rounded-2xl space-y-2">
            <span className="text-xs text-zinc-300 font-medium block">
              To Earn Revenue Target:
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400 font-mono">₹</span>
              <input
                type="number"
                step="10000"
                value={targetRevenue}
                onChange={(e) => setTargetRevenue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-sm font-bold bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div className="text-xs text-emerald-400 font-semibold pt-1">
              {callsNeededForRevenue > 0
                ? `Requires ~${callsNeededForRevenue} calls`
                : "Enter call data above"}
            </div>
          </div>

          {/* Commission Target Goal */}
          <div className="p-4 bg-zinc-800/80 border border-zinc-700/60 rounded-2xl space-y-2">
            <span className="text-xs text-zinc-300 font-medium block">
              To Earn Commission Target:
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400 font-mono">₹</span>
              <input
                type="number"
                step="1000"
                value={targetCommission}
                onChange={(e) => setTargetCommission(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-sm font-bold bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div className="text-xs text-zinc-300 font-semibold pt-1">
              {callsNeededForCommission > 0
                ? `Requires ~${callsNeededForCommission} calls`
                : "Enter call data above"}
            </div>
          </div>
        </div>

        {/* Ambient Blur */}
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-zinc-800 rounded-full opacity-50 blur-3xl pointer-events-none"></div>
      </div>
    </div>
  );
}
