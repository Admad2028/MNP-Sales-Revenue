import { useState, useMemo } from "react";
import { SheetRecord } from "../types";
import { formatINR, formatDateDisplay, SALESPERSON_COLORS } from "../utils/sheetParser";
import {
  Table,
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowUpDown
} from "lucide-react";

interface DailyRecordsTableProps {
  records: SheetRecord[];
  salesperson: string;
  startDate: string;
  endDate: string;
}

export function DailyRecordsTable({
  records,
  salesperson,
  startDate,
  endDate,
}: DailyRecordsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [sortField, setSortField] = useState<"date" | "dealAmount" | "aaCommission" | "dealsClosed">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Filter records
  const filtered = useMemo(() => {
    return records
      .filter((r) => {
        if (salesperson !== "All" && r.executive.toLowerCase() !== salesperson.toLowerCase()) {
          return false;
        }
        if (startDate && r.date < startDate) return false;
        if (endDate && r.date > endDate) return false;
        if (onlyDeals && r.dealsClosed <= 0 && r.dealAmount <= 0) return false;

        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matches =
            r.executive.toLowerCase().includes(q) ||
            r.movementType.toLowerCase().includes(q) ||
            (r.originCity && r.originCity.toLowerCase().includes(q)) ||
            r.remarks.toLowerCase().includes(q) ||
            r.rawDate.toLowerCase().includes(q) ||
            r.date.includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === "string") {
          return sortOrder === "asc"
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }
        return sortOrder === "asc"
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [records, salesperson, startDate, endDate, onlyDeals, searchTerm, sortField, sortOrder]);

  const handleSort = (field: "date" | "dealAmount" | "aaCommission" | "dealsClosed") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const exportTableCSV = () => {
    const headers = [
      "Date",
      "Executive Name",
      "No of Dialled Calls (Col C)",
      "Spam / Not Interested",
      "Genuine Calls",
      "Pending Leads",
      "Prospects Created",
      "Deals Closed (Col I)",
      "Movement Type",
      "Origin City (Col K)",
      "Deal Amount (INR)",
      "AA Commission (INR)",
      "AA %",
      "Remarks",
    ];

    const rows = filtered.map((r) => [
      r.rawDate || r.date,
      r.executive,
      r.dialledCalls !== undefined && r.dialledCalls > 0 ? r.dialledCalls : "",
      r.spamEtc,
      r.genuineCalls,
      r.pendingLeads,
      r.prospects,
      r.dealsClosed,
      `"${(r.movementType || "").replace(/"/g, '""')}"`,
      `"${(r.originCity || "-").replace(/"/g, '""')}"`,
      r.dealAmount,
      r.aaCommission,
      r.aaCommissionPercentage,
      `"${(r.remarks || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sales_records_${salesperson}_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
      {/* Header with Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              Detailed Sheet Records Log
            </h3>
            <p className="text-xs text-zinc-500">
              Showing {filtered.length} entry{filtered.length === 1 ? "" : "ies"} matching criteria
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search remarks, movement..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none w-44 sm:w-56 text-zinc-900 font-medium"
            />
          </div>

          {/* Deals Only Toggle */}
          <button
            type="button"
            onClick={() => setOnlyDeals(!onlyDeals)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 ${
              onlyDeals
                ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>Deals Only</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportTableCSV}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3 h-3 text-zinc-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-zinc-200 rounded-2xl">
        <table className="min-w-full divide-y divide-zinc-100 text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">
            <tr>
              <th
                onClick={() => handleSort("date")}
                className="py-3 px-3.5 cursor-pointer hover:bg-zinc-100/80 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-3">Executive</th>
              <th className="py-3 px-2 text-center" title="Column C (No of Dialled Calls)">
                Dialled (Col C)
              </th>
              <th className="py-3 px-2 text-center">Genuine Calls</th>
              <th className="py-3 px-2 text-center">Spam/NP</th>
              <th className="py-3 px-2 text-center">Prospects</th>
              <th
                onClick={() => handleSort("dealsClosed")}
                className="py-3 px-2 text-center cursor-pointer hover:bg-zinc-100/80 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Deals (Col I)</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-3">Movement</th>
              <th className="py-3 px-3">Origin City (Col K)</th>
              <th
                onClick={() => handleSort("dealAmount")}
                className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-100/80 transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Deal Amount</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort("aaCommission")}
                className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-100/80 transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>AA Comm.</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-3">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-8 text-center text-zinc-400">
                  No records match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const style =
                  SALESPERSON_COLORS[r.executive] || SALESPERSON_COLORS["All"];
                const hasDeal = r.dealsClosed > 0 || r.dealAmount > 0;
                const dialledCount = r.dialledCalls || 0;

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-zinc-50 transition-colors ${
                      hasDeal ? "bg-emerald-50/20" : ""
                    }`}
                  >
                    <td className="py-3 px-3.5 whitespace-nowrap font-medium text-zinc-800">
                      {formatDateDisplay(r.date)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold ${style.badge}`}
                      >
                        {r.executive}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-zinc-900 font-bold">
                      {dialledCount > 0 ? dialledCount : "-"}
                    </td>
                    <td className="py-3 px-2 text-center text-zinc-900 font-bold">
                      {r.genuineCalls}
                    </td>
                    <td className="py-3 px-2 text-center text-zinc-400">
                      {r.spamEtc}
                    </td>
                    <td className="py-3 px-2 text-center text-amber-700 font-semibold">
                      {r.prospects}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {r.dealsClosed > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-900 text-white">
                          {r.dealsClosed}
                        </span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-zinc-600 truncate max-w-[130px]">
                      {r.movementType || "-"}
                    </td>
                    <td className="py-3 px-3 text-zinc-800 font-medium whitespace-nowrap">
                      {r.originCity && r.originCity !== "0" && r.originCity !== "-" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-800 border border-red-200/60">
                          {r.originCity}
                        </span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-zinc-900">
                      {r.dealAmount > 0 ? formatINR(r.dealAmount) : "-"}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-semibold text-emerald-800">
                      {r.aaCommission > 0 ? (
                        <div>
                          <span>{formatINR(r.aaCommission)}</span>
                          {r.aaCommissionPercentage && (
                            <span className="text-[10px] text-zinc-400 block font-normal">
                              ({r.aaCommissionPercentage})
                            </span>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-[11px] truncate max-w-[150px]">
                      {r.remarks || "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
