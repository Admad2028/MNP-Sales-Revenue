import { useState } from "react";
import {
  Trophy,
  Users,
  Award,
  DollarSign,
  PhoneCall,
  Flame,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import { SheetRecord, SalespersonMetric } from "../types";
import { calculateAllSalespeopleMetrics } from "../utils/calculations";
import { formatINR, SALESPERSON_COLORS } from "../utils/sheetParser";

interface TeamLeaderboardProps {
  records: SheetRecord[];
  startDate: string;
  endDate: string;
  onSelectPerson: (name: string) => void;
  selectedPerson: string;
  teamCalls?: Record<string, number>;
}

export function TeamLeaderboard({
  records,
  startDate,
  endDate,
  onSelectPerson,
  selectedPerson,
  teamCalls,
}: TeamLeaderboardProps) {
  // Custom calls map per salesperson
  const [customCalls, setCustomCalls] = useState<Record<string, number>>({});

  const handleCallChange = (name: string, calls: number) => {
    setCustomCalls((prev) => ({
      ...prev,
      [name]: Math.max(0, calls),
    }));
  };

  const metrics = calculateAllSalespeopleMetrics(
    records,
    startDate,
    endDate,
    teamCalls || customCalls
  );

  // Filter to the 5 core team members requested + storage team
  const coreTeam = metrics.filter((m) => m.name !== "Storage Team");

  // Sort by revenue per call (descending)
  const sortedByRevenuePerCall = [...coreTeam].sort(
    (a, b) => b.revenuePerCall - a.revenuePerCall
  );

  const topRevenueRep = [...coreTeam].sort(
    (a, b) => b.totalDealAmount - a.totalDealAmount
  )[0];

  const topCommissionRep = [...coreTeam].sort(
    (a, b) => b.totalAaCommission - a.totalAaCommission
  )[0];

  const topDealsRep = [...coreTeam].sort(
    (a, b) => b.totalDeals - a.totalDeals
  )[0];

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800 font-bold">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              Team Call Efficiency & Leaderboard
            </h3>
            <p className="text-xs text-zinc-500">
              {coreTeam.length > 0
                ? `Compare ${coreTeam.map((m) => m.name).join(", ")} for the selected date range`
                : "Compare team members for the selected date range"}
            </p>
          </div>
        </div>

        {/* Badges of honor */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {topRevenueRep && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              <Flame className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Top Revenue: <strong>{topRevenueRep.name}</strong> ({formatINR(topRevenueRep.totalDealAmount)})
              </span>
            </div>
          )}
          {topCommissionRep && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200 font-medium">
              <Award className="w-3.5 h-3.5 text-zinc-700" />
              <span>
                Top Commission: <strong>{topCommissionRep.name}</strong> ({formatINR(topCommissionRep.totalAaCommission)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Cards / Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-100 text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
              <th className="py-3 px-3.5">Rank & Salesperson</th>
              <th className="py-3 px-3">Calls Entered</th>
              <th className="py-3 px-3 text-right">Revenue / Call</th>
              <th className="py-3 px-3 text-right">AA Comm. / Call</th>
              <th className="py-3 px-3 text-right">Total Revenue</th>
              <th className="py-3 px-3 text-right">Total Comm.</th>
              <th className="py-3 px-3 text-center">Deals</th>
              <th className="py-3 px-3.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedByRevenuePerCall.map((person, index) => {
              const style = SALESPERSON_COLORS[person.name] || SALESPERSON_COLORS["All"];
              const isSelected = selectedPerson === person.name;

              return (
                <tr
                  key={person.name}
                  className={`transition-colors ${
                    isSelected ? "bg-zinc-100/80 font-medium" : "hover:bg-zinc-50/80"
                  }`}
                >
                  {/* Name & Rank */}
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? "bg-amber-100 text-amber-900 shadow-xs"
                            : index === 1
                            ? "bg-zinc-200 text-zinc-800"
                            : index === 2
                            ? "bg-amber-50 text-amber-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${style.badge}`}
                      >
                        {person.name.charAt(0)}
                      </div>
                      <span className="font-bold text-zinc-900">
                        {person.name}
                      </span>
                    </div>
                  </td>

                  {/* Calls Input Field */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="1"
                        value={person.enteredCalls}
                        onChange={(e) =>
                          handleCallChange(
                            person.name,
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-20 px-2.5 py-1 text-xs font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 shadow-inner"
                      />
                      <span className="text-[11px] text-zinc-400">calls</span>
                    </div>
                  </td>

                  {/* Revenue / Call */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-emerald-700">
                      {formatINR(person.revenuePerCall, 2)}
                    </span>
                  </td>

                  {/* AA Comm. / Call */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-zinc-900">
                      {formatINR(person.commissionPerCall, 2)}
                    </span>
                  </td>

                  {/* Total Deal Amount */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-right font-semibold text-zinc-900">
                    {formatINR(person.totalDealAmount)}
                  </td>

                  {/* Total AA Commission */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-right font-medium text-emerald-700">
                    {formatINR(person.totalAaCommission)}
                  </td>

                  {/* Deals Closed */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                      {person.totalDeals} deal{person.totalDeals === 1 ? "" : "s"}
                    </span>
                  </td>

                  {/* Action Button */}
                  <td className="py-3.5 px-3.5 whitespace-nowrap text-center">
                    <button
                      type="button"
                      onClick={() => onSelectPerson(person.name)}
                      className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all ${
                        isSelected
                          ? "bg-zinc-900 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
                      }`}
                    >
                      {isSelected ? "Active Focus" : "Focus Rep"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
