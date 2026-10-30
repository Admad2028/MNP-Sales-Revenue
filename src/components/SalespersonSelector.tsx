import { User, Users, Trophy } from "lucide-react";
import { DEFAULT_SALESPEOPLE, SALESPERSON_COLORS, formatDateDDMMYY, getSalespeopleForDateRange } from "../utils/sheetParser";
import { SheetRecord } from "../types";
import { useMemo } from "react";

interface SalespersonSelectorProps {
  selectedSalesperson: string;
  onSelect: (name: string) => void;
  allRecords: SheetRecord[];
  startDate: string;
  endDate: string;
}

export function SalespersonSelector({
  selectedSalesperson,
  onSelect,
  allRecords,
  startDate,
  endDate,
}: SalespersonSelectorProps) {
  const hasDateRange = Boolean(startDate && endDate);
  const activeSalespeople = useMemo(
    () => getSalespeopleForDateRange(startDate, endDate, allRecords),
    [startDate, endDate, allRecords]
  );

  // Quick pre-aggregation of deals & revenue in selected date range for badges
  const statsMap = useMemo(() => {
    const map: Record<string, { deals: number; revenue: number; genuineCalls: number }> = {};
    
    // Initialize
    [...activeSalespeople, "Storage Team", "All"].forEach((p) => {
      map[p] = { deals: 0, revenue: 0, genuineCalls: 0 };
    });

    // If no valid date range is selected, return empty 0 stats
    if (!hasDateRange) {
      return map;
    }

    allRecords.forEach((r) => {
      if (startDate && r.date < startDate) return;
      if (endDate && r.date > endDate) return;

      if (!map[r.executive]) {
        map[r.executive] = { deals: 0, revenue: 0, genuineCalls: 0 };
      }
      map[r.executive].deals += r.dealsClosed;
      map[r.executive].revenue += r.dealAmount;
      map[r.executive].genuineCalls += r.genuineCalls;

      map["All"].deals += r.dealsClosed;
      map["All"].revenue += r.dealAmount;
      map["All"].genuineCalls += r.genuineCalls;
    });

    return map;
  }, [allRecords, startDate, endDate, hasDateRange, activeSalespeople]);

  const teamList = ["All", ...activeSalespeople];

  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return "No date range selected";
    if (startDate && !endDate) return `From ${formatDateDDMMYY(startDate)}`;
    if (!startDate && endDate) return `Up to ${formatDateDDMMYY(endDate)}`;
    if (startDate === endDate) return formatDateDDMMYY(startDate);
    return `${formatDateDDMMYY(startDate)} to ${formatDateDDMMYY(endDate)}`;
  }, [startDate, endDate]);

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-zinc-700" />
          1. Salesperson Selection
        </h3>
        <span className="text-xs text-zinc-500">
          Showing deals & sales for:{" "}
          <span className="font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
            {dateRangeLabel}
          </span>
        </span>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-3 ${
        teamList.length <= 5
          ? "lg:grid-cols-5"
          : teamList.length <= 6
          ? "lg:grid-cols-6"
          : "lg:grid-cols-7"
      } gap-2.5`}>
        {teamList.map((person) => {
          const isSelected = selectedSalesperson === person;
          const stats = statsMap[person] || { deals: 0, revenue: 0, genuineCalls: 0 };
          const style = SALESPERSON_COLORS[person] || SALESPERSON_COLORS["All"];

          return (
            <button
              key={person}
              id={`btn-select-person-${person.toLowerCase()}`}
              type="button"
              onClick={() => onSelect(person)}
              className={`relative flex flex-col p-3.5 text-left rounded-2xl border transition-all duration-150 ${
                isSelected
                  ? `bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10`
                  : `bg-zinc-50 border-zinc-200 hover:bg-zinc-100/80 hover:border-zinc-300 text-zinc-700`
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  {person === "All" ? (
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isSelected ? "bg-zinc-800 text-emerald-400" : "bg-zinc-200 text-zinc-800"
                    }`}>
                      <Users className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? "bg-zinc-800 text-emerald-400" : style.badge
                      }`}
                    >
                      {person.charAt(0)}
                    </div>
                  )}
                  <span
                    className={`text-sm font-semibold truncate ${
                      isSelected ? "text-white" : "text-zinc-900"
                    }`}
                  >
                    {person === "All" ? "Whole Team" : person}
                  </span>
                </div>
                {isSelected ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                ) : (
                  <span className="text-zinc-400 text-xs">→</span>
                )}
              </div>

              {/* Only display deals and revenue data when a date range is actively selected */}
              {hasDateRange && (
                <div className={`flex items-center justify-between text-xs mt-2.5 pt-2 border-t ${
                  isSelected ? "border-zinc-800 text-zinc-400" : "border-zinc-200/80 text-zinc-500"
                }`}>
                  <span>
                    <strong className={isSelected ? "text-zinc-200" : "text-zinc-800"}>{stats.deals}</strong> deals
                  </span>
                  <span className={`font-semibold ${isSelected ? "text-emerald-400" : "text-zinc-900"}`}>
                    {stats.revenue >= 1000
                      ? `₹${(stats.revenue / 1000).toFixed(0)}k`
                      : `₹${stats.revenue}`}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
