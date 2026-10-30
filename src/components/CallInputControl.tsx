import { PhoneCall, Sparkles, X, Users, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { SheetRecord } from "../types";
import { DEFAULT_SALESPEOPLE, SALESPERSON_COLORS, formatINR, getSalespeopleForDateRange, formatDateDisplay } from "../utils/sheetParser";
import { useMemo } from "react";

interface CallInputControlProps {
  salesperson: string;
  numberOfCalls: number;
  onCallsChange: (calls: number) => void;
  matchingSheetRecords: SheetRecord[];
  allRecords: SheetRecord[];
  teamCalls: Record<string, number>;
  onIndividualCallChange: (name: string, calls: number) => void;
  onAutoFillTeamCalls: (callsMap: Record<string, number>) => void;
  onClearTeamCalls: () => void;
  startDate: string;
  endDate: string;
}

export function CallInputControl({
  salesperson,
  numberOfCalls,
  onCallsChange,
  matchingSheetRecords,
  allRecords,
  teamCalls,
  onIndividualCallChange,
  onAutoFillTeamCalls,
  onClearTeamCalls,
  startDate,
  endDate,
}: CallInputControlProps) {
  const activeSalespeople = useMemo(
    () => getSalespeopleForDateRange(startDate, endDate, allRecords),
    [startDate, endDate, allRecords]
  );

  // Aggregate stats per salesperson for the selected date range
  const repStatsMap = useMemo(() => {
    const people = [...activeSalespeople, "Storage Team"];
    const map: Record<
      string,
      {
        dialledCalls: number;
        connectedCalls: number;
        genuineCalls: number;
        leadsAllocated: number;
        dealsClosed: number;
        dealAmount: number;
        aaCommission: number;
      }
    > = {};

    people.forEach((p) => {
      map[p] = {
        dialledCalls: 0,
        connectedCalls: 0,
        genuineCalls: 0,
        leadsAllocated: 0,
        dealsClosed: 0,
        dealAmount: 0,
        aaCommission: 0,
      };
    });

    allRecords.forEach((r) => {
      if (startDate && r.date < startDate) return;
      if (endDate && r.date > endDate) return;

      if (!map[r.executive]) {
        map[r.executive] = {
          dialledCalls: 0,
          connectedCalls: 0,
          genuineCalls: 0,
          leadsAllocated: 0,
          dealsClosed: 0,
          dealAmount: 0,
          aaCommission: 0,
        };
      }
      // Strictly use dialledCalls (Column C in September)
      const dialled = r.dialledCalls || 0;
      map[r.executive].dialledCalls += dialled;
      map[r.executive].connectedCalls += r.connectedCalls || 0;
      map[r.executive].genuineCalls += r.genuineCalls;
      map[r.executive].leadsAllocated += r.leadsAllocated;
      map[r.executive].dealsClosed += r.dealsClosed;
      map[r.executive].dealAmount += r.dealAmount;
      map[r.executive].aaCommission += r.aaCommission;
    });

    return map;
  }, [allRecords, startDate, endDate]);

  // Aggregate genuine calls and leads from sheet for single salesperson
  const singleRepSheetCounts = useMemo(() => {
    let dialledCalls = 0;
    let connectedCalls = 0;
    let genuineCalls = 0;
    let leadsAllocated = 0;
    matchingSheetRecords.forEach((r) => {
      dialledCalls += r.dialledCalls || 0;
      connectedCalls += r.connectedCalls || 0;
      genuineCalls += r.genuineCalls;
      leadsAllocated += r.leadsAllocated;
    });
    return { dialledCalls, connectedCalls, genuineCalls, leadsAllocated };
  }, [matchingSheetRecords]);

  // Total Col C dialled calls available in sheet for active date range
  const totalSheetDialledCalls = useMemo(() => {
    return Object.values(repStatsMap).reduce(
      (sum: number, s: { dialledCalls: number }) => sum + (s.dialledCalls || 0),
      0
    );
  }, [repStatsMap]);

  // Total team calls calculated
  const totalTeamCalls = useMemo(() => {
    return Object.values(teamCalls).reduce((sum: number, val: number) => sum + (val || 0), 0);
  }, [teamCalls]);

  const activeRepsWithCalls = useMemo(() => {
    return Object.entries(teamCalls).filter(([_, count]) => (count || 0) > 0).length;
  }, [teamCalls]);

  // Handle Fill All from Column C (No of Dialled Calls)
  const handleFillAllFromSheet = () => {
    const newMap: Record<string, number> = {};
    [...activeSalespeople, "Storage Team"].forEach((p) => {
      const stats = repStatsMap[p];
      newMap[p] = stats?.dialledCalls || 0;
    });
    onAutoFillTeamCalls(newMap);
  };

  // If Whole Team is selected, render individual call inputs for each salesperson
  if (salesperson === "All") {
    const displayTeamList: string[] = [...activeSalespeople];
    // Only include Storage Team if it has records or calls
    if (
      repStatsMap["Storage Team"]?.dealAmount > 0 ||
      repStatsMap["Storage Team"]?.dialledCalls > 0 ||
      repStatsMap["Storage Team"]?.genuineCalls > 0 ||
      (teamCalls["Storage Team"] || 0) > 0
    ) {
      displayTeamList.push("Storage Team");
    }

    return (
      <div className="bg-white border border-zinc-200/90 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5 ring-1 ring-black/[0.02]">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-700" />
                3. Calls Done per Salesperson (Whole Team)
              </h3>
              <span className="text-[11px] font-bold text-zinc-800 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-lg">
                {formatDateDisplay(startDate)}{startDate !== endDate ? ` to ${formatDateDisplay(endDate)}` : ""}
              </span>
              {totalSheetDialledCalls > 0 && (
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Sheet Col C: {totalSheetDialledCalls} Dialled Calls
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Directly mapped from Column C (No of Dialled Calls) of the Google Sheet for the chosen date range
            </p>
          </div>

          {/* Action Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-fill-all-sheet-calls"
              onClick={handleFillAllFromSheet}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors shadow-2xs"
              title="Pulls Column C (No of Dialled Calls) directly from the sheet for every salesperson"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Fill All from Col C ({totalSheetDialledCalls} Calls)</span>
            </button>

            {totalTeamCalls > 0 && (
              <button
                type="button"
                onClick={onClearTeamCalls}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-2.5 py-1.5 rounded-xl transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-bold shadow-xs">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
              <span>{totalTeamCalls} Total Calls Entered</span>
            </div>
          </div>
        </div>

        {/* Salespeople Individual Call Input Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {displayTeamList.map((person) => {
            const style = SALESPERSON_COLORS[person] || SALESPERSON_COLORS["All"];
            const stats = repStatsMap[person] || {
              dialledCalls: 0,
              connectedCalls: 0,
              genuineCalls: 0,
              leadsAllocated: 0,
              dealsClosed: 0,
              dealAmount: 0,
              aaCommission: 0,
            };
            const targetSheetCalls = stats.dialledCalls > 0 ? stats.dialledCalls : stats.genuineCalls;
            const currentCalls = teamCalls[person] || 0;
            const revenuePerCall = currentCalls > 0 ? stats.dealAmount / currentCalls : 0;
            const commPerCall = currentCalls > 0 ? stats.aaCommission / currentCalls : 0;
            const convRate = currentCalls > 0 ? (stats.dealsClosed / currentCalls) * 100 : 0;
            const isSyncedWithColC = stats.dialledCalls > 0 && currentCalls === stats.dialledCalls;

            return (
              <div
                key={person}
                className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                  currentCalls > 0
                    ? "bg-zinc-50/90 border-zinc-300 ring-1 ring-zinc-200 shadow-xs"
                    : "bg-zinc-50/40 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {/* Person Header */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${style.badge}`}
                      >
                        {person.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-zinc-900 block leading-tight">
                          {person}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {stats.dealsClosed} deals • {formatINR(stats.dealAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sheet Call Metrics Pill Strip */}
                  <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px] font-semibold">
                    <span
                      title="Column C: Dialled Calls from Sheet"
                      className={`px-2 py-0.5 rounded-md border ${
                        stats.dialledCalls > 0
                          ? "bg-zinc-900 text-white font-bold border-zinc-900"
                          : "bg-zinc-100 text-zinc-400 border-zinc-200"
                      }`}
                    >
                      Col C: {stats.dialledCalls} dialled
                    </span>
                    <span
                      title="Column D: Connected Calls from Sheet"
                      className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200"
                    >
                      Conn: {stats.connectedCalls}
                    </span>
                    <span
                      title="Column F: Genuine Interested Client Calls"
                      className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200"
                    >
                      Gen: {stats.genuineCalls}
                    </span>
                  </div>
                </div>

                {/* Input Field & Controls */}
                <div className="space-y-2 my-1">
                  <div className="relative">
                    <input
                      id={`input-calls-${person.toLowerCase()}`}
                      type="number"
                      min={0}
                      value={currentCalls === 0 ? "" : currentCalls}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                        onIndividualCallChange(person, isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      placeholder="0 calls"
                      className="w-full bg-white border border-zinc-300 focus:border-zinc-900 rounded-xl px-3 py-2 text-base font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-300 placeholder:font-normal"
                    />
                    {currentCalls > 0 && (
                      <button
                        type="button"
                        onClick={() => onIndividualCallChange(person, 0)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sheet Reference & Quick Sync Action */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 min-h-[22px]">
                    {isSyncedWithColC ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Synced with Col C ({stats.dialledCalls})
                      </span>
                    ) : targetSheetCalls > 0 ? (
                      <button
                        type="button"
                        onClick={() => onIndividualCallChange(person, targetSheetCalls)}
                        className="text-emerald-700 font-semibold hover:text-emerald-900 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]"
                        title={`Use ${targetSheetCalls} calls from Column C`}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        Use Col C ({targetSheetCalls})
                      </button>
                    ) : (
                      <span className="text-zinc-400 italic text-[10px]">
                        No Col C calls
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Individual Yield Preview */}
                <div className="pt-2 mt-1 border-t border-zinc-200/60 text-[11px]">
                  {currentCalls > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-zinc-700">
                        <span className="text-zinc-500">Rev / Call:</span>
                        <span className="font-bold text-emerald-700">
                          {formatINR(revenuePerCall, 1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-700">
                        <span className="text-zinc-500">AA Comm / Call:</span>
                        <span className="font-bold text-zinc-900">
                          {formatINR(commPerCall, 1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-700">
                        <span className="text-zinc-500">Conv. Rate:</span>
                        <span className="font-semibold text-zinc-800">
                          {convRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic">Enter calls to compute yield</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Synopsis Notice */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs text-zinc-600">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Calls active for <strong>{activeRepsWithCalls}</strong> sales reps (
              <strong>{totalTeamCalls} total team calls</strong> entered).
            </span>
          </div>
          <span className="text-zinc-500">
            Picks up Column C ("No of Dialled Calls") for <strong>{formatDateDisplay(startDate)}{startDate !== endDate ? ` to ${formatDateDisplay(endDate)}` : ""}</strong> ({totalSheetDialledCalls} total in sheet).
          </span>
        </div>
      </div>
    );
  }

  // Single Salesperson View - uses dialled calls from Column C
  const targetSingleCalls = singleRepSheetCounts.dialledCalls || 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-zinc-700" />
            3. Calls Done for {salesperson} (Revenue / Call & Conversion)
          </h3>
        </div>
        {numberOfCalls > 0 && (
          <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 self-start sm:self-auto">
            {numberOfCalls} calls active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-1">
        {/* Input box */}
        <div className="md:col-span-6 relative">
          <input
            id="input-calls-done"
            type="number"
            min={0}
            value={numberOfCalls === 0 ? "" : numberOfCalls}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
              onCallsChange(isNaN(val) ? 0 : Math.max(0, val));
            }}
            placeholder={`Enter number of calls done by ${salesperson}...`}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xl sm:text-2xl font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all shadow-inner placeholder:text-zinc-400 placeholder:font-normal placeholder:text-sm"
          />
          {numberOfCalls > 0 && (
            <button
              type="button"
              onClick={() => onCallsChange(0)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 bg-white border border-zinc-200 px-2.5 py-1 rounded-xl shadow-xs transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Reference & helpers */}
        <div className="md:col-span-6 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {targetSingleCalls > 0 ? (
            <>
              <span className="text-zinc-400">Col C (Sheet):</span>
              <span className="font-semibold text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-xl border border-zinc-200">
                {targetSingleCalls} calls
              </span>
              {numberOfCalls !== targetSingleCalls && (
                <button
                  type="button"
                  onClick={() => onCallsChange(targetSingleCalls)}
                  className="text-zinc-900 font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Use {targetSingleCalls} (Col C)
                </button>
              )}
            </>
          ) : (
            <span className="text-zinc-500 bg-zinc-100 px-3 py-1 rounded-xl border border-zinc-200">
              0 calls recorded in Column C for this period
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
