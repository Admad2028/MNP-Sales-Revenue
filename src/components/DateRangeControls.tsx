import { Clock, ArrowRight, Calendar } from "lucide-react";
import { useMemo } from "react";
import { formatDateDisplay, getISTDateString } from "../utils/sheetParser";

interface DateRangeControlsProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  minDate: string;
  maxDate: string;
}

export function DateRangeControls({
  startDate,
  endDate,
  onDateChange,
  minDate,
  maxDate,
}: DateRangeControlsProps) {
  // Compute preset dates based on Indian Standard Time (IST - Asia/Kolkata)
  const { todayDate, yesterdayDate, last7DaysDate, thisMonthStart, lastMonthStart, lastMonthEnd } = useMemo(() => {
    const today = getISTDateString(0);
    const yesterday = getISTDateString(-1);
    const l7Start = getISTDateString(-6);

    const [yearStr, monthStr] = today.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10); // 1-12

    // Current month: e.g. 2026-08-01
    const tmStart = `${yearStr}-${monthStr.padStart(2, "0")}-01`;

    // Previous month
    const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
    const py = prevMonthDate.getUTCFullYear();
    const pm = String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0");
    const lmStart = `${py}-${pm}-01`;

    // Last day of previous month
    const lastDayPrevMonth = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const lmEnd = `${py}-${pm}-${String(lastDayPrevMonth).padStart(2, "0")}`;

    return {
      todayDate: today,
      yesterdayDate: yesterday,
      last7DaysDate: l7Start,
      thisMonthStart: tmStart,
      lastMonthStart: lmStart,
      lastMonthEnd: lmEnd,
    };
  }, []);

  const quickPresets = [
    {
      id: "this_month",
      label: "Oct MTD (01/10 – Today)",
      start: thisMonthStart,
      end: maxDate && maxDate.startsWith(thisMonthStart.substring(0, 7)) ? maxDate : todayDate,
      isPrimary: true,
      badge: "Current Month",
    },
    {
      id: "latest_day",
      label: maxDate ? `Latest (${formatDateDisplay(maxDate).substring(0, 5)})` : "Latest Logged",
      start: maxDate || todayDate,
      end: maxDate || todayDate,
      isPrimary: true,
    },
    {
      id: "yesterday",
      label: "Yesterday",
      start: yesterdayDate,
      end: yesterdayDate,
      isPrimary: false,
    },
    {
      id: "sep_month",
      label: "September 2026",
      start: "2026-09-01",
      end: "2026-09-30",
      isPrimary: false,
    },
    {
      id: "aug_month",
      label: "August 2026",
      start: "2026-08-01",
      end: "2026-08-31",
      isPrimary: false,
    },
    {
      id: "all_time",
      label: "All Data Range",
      start: minDate || "2026-07-01",
      end: maxDate || todayDate,
      isPrimary: false,
    },
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-700" />
            2. Date Range & Quick Presets
          </h3>
        </div>
        <div className="text-xs text-zinc-600 font-semibold bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200 self-start sm:self-auto flex items-center gap-1.5">
          {startDate && endDate ? (
            <>
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>{formatDateDisplay(startDate)}</span>
              <ArrowRight className="inline w-3 h-3 text-zinc-400" />
              <span>{formatDateDisplay(endDate)}</span>
              <button
                type="button"
                onClick={() => onDateChange(thisMonthStart, todayDate)}
                className="ml-1.5 text-[10px] text-zinc-500 hover:text-zinc-900 bg-zinc-200/70 hover:bg-zinc-200 px-2 py-0.5 rounded font-medium transition-all"
                title="Reset to 1st of current month to today"
              >
                Reset to MTD
              </button>
            </>
          ) : (
            <>
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>{formatDateDisplay(thisMonthStart)}</span>
              <ArrowRight className="inline w-3 h-3 text-zinc-400" />
              <span>{formatDateDisplay(todayDate)}</span>
              <span className="text-zinc-400 text-[10px] ml-1">(Current Month to Date)</span>
            </>
          )}
        </div>
      </div>

      {/* Quick Presets Buttons & Custom Date Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
        {/* Presets */}
        <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
          {quickPresets.map((p) => {
            const isActive = startDate === p.start && endDate === p.end;
            return (
              <button
                key={p.id}
                id={`btn-preset-${p.id}`}
                type="button"
                onClick={() => onDateChange(p.start, p.end)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm ring-2 ring-zinc-900/10"
                    : p.isPrimary
                    ? "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-300 font-bold"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
                }`}
              >
                <Clock className="w-3 h-3 opacity-60" />
                <span>{p.label}</span>
                {p.badge && !isActive && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md font-bold">
                    {p.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Pickers */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="input-start-date"
              className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1"
            >
              From Date
            </label>
            <input
              id="input-start-date"
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
            <div className="text-[10px] text-zinc-500 mt-1 font-medium pl-0.5">
              {formatDateDisplay(startDate)} <span className="text-zinc-400">(DD/MM/YYYY)</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="input-end-date"
              className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1"
            >
              To Date
            </label>
            <input
              id="input-end-date"
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
            <div className="text-[10px] text-zinc-500 mt-1 font-medium pl-0.5">
              {formatDateDisplay(endDate)} <span className="text-zinc-400">(DD/MM/YYYY)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

