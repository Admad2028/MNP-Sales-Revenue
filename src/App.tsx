import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import {
  DEFAULT_SHEET_URL,
  DEFAULT_SALESPEOPLE,
  fetchLiveSheetData,
  formatDateDisplay,
  getDefaultDateRange,
  getSalespeopleForDateRange,
  normalizeAndResolveDate,
} from "./utils/sheetParser";
import { INITIAL_SHEET_RECORDS } from "./data/initialSheetData";
import {
  calculateMetrics,
  getDateBounds,
  filterRecords,
  calculateSheetCallsForDateRange,
} from "./utils/calculations";
import { SheetRecord, SheetSyncStatus, AnomalyRecord } from "./types";
import { Header } from "./components/Header";
import { SalespersonSelector } from "./components/SalespersonSelector";
import { DateRangeControls } from "./components/DateRangeControls";
import { CallInputControl } from "./components/CallInputControl";
import { PrimaryMetricCards } from "./components/PrimaryMetricCards";
import { CallYieldCards } from "./components/CallYieldCards";
import { EfficiencyAnalytics } from "./components/EfficiencyAnalytics";
import { VisualChart } from "./components/VisualChart";
import { MonthlyComparisonChart } from "./components/MonthlyComparisonChart";
import { DailyRecordsTable } from "./components/DailyRecordsTable";
import { IndiaOriginHeatMap } from "./components/IndiaOriginHeatMap";
import { downloadPdfReport } from "./utils/pdfGenerator";
import {
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
} from "lucide-react";

export default function App() {
  // Master Sheet Data State
  const [sheetRecords, setSheetRecords] = useState<SheetRecord[]>(INITIAL_SHEET_RECORDS);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [sheetUrl, setSheetUrl] = useState<string>(DEFAULT_SHEET_URL);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SheetSyncStatus>({
    isSyncing: false,
    lastSyncedAt: new Date(),
    error: null,
    totalRows: INITIAL_SHEET_RECORDS.length,
    sourceUrl: DEFAULT_SHEET_URL,
    dateRangeInData: { start: "2026-07-01", end: "2026-10-06" },
  });

  // User Calculation Inputs (Default: 1st of the current month to today's date)
  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
  const [salesperson, setSalesperson] = useState<string>("All");
  const [startDate, setStartDate] = useState<string>(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState<string>(defaultDateRange.endDate);

  // Auto-reset salesperson to 'All' if selected rep is not active in the chosen date period
  useEffect(() => {
    const isSeptOnwards = (!startDate && !endDate) || (startDate && startDate >= "2026-09-01");
    if (isSeptOnwards && salesperson === "Meghna") {
      setSalesperson("All");
    }
    const isStrictlyBeforeOct = endDate && endDate < "2026-10-01";
    if (isStrictlyBeforeOct && salesperson === "Rutuja") {
      setSalesperson("All");
    }
  }, [startDate, endDate, salesperson]);

  // Calls per salesperson state map (supports Whole Team per-rep breakdown, active reps from Oct)
  const [teamCalls, setTeamCalls] = useState<Record<string, number>>({
    Shruti: 0,
    Vaishnavi: 0,
    Nidhi: 0,
    Prithviraj: 0,
    Rutuja: 0,
    "Storage Team": 0,
  });

  // Optional expandable view for raw records log
  const [showRawTable, setShowRawTable] = useState<boolean>(false);

  // Total calls calculated based on active salesperson selection
  const currentSalespersonCalls = useMemo(() => {
    if (salesperson === "All") {
      return Object.values(teamCalls).reduce((sum: number, val: number) => sum + (val || 0), 0);
    }
    return teamCalls[salesperson] || 0;
  }, [salesperson, teamCalls]);

  // Handler for single salesperson call input
  const handleCallsChange = (calls: number) => {
    const val = Math.max(0, calls);
    if (salesperson !== "All") {
      setTeamCalls((prev) => ({
        ...prev,
        [salesperson]: val,
      }));
    } else {
      // If changed directly in All mode, distribute equally across active salespeople
      const activeTeam = getSalespeopleForDateRange(startDate, endDate);
      const repCount = activeTeam.length || 4;
      const perRep = Math.round(val / repCount);
      const updated: Record<string, number> = {};
      activeTeam.forEach((p) => {
        updated[p] = perRep;
      });
      setTeamCalls((prev) => ({
        ...prev,
        ...updated,
      }));
    }
  };

  // Handler for changing an individual salesperson's calls in Whole Team view
  const handleIndividualCallChange = (name: string, calls: number) => {
    setTeamCalls((prev) => ({
      ...prev,
      [name]: Math.max(0, calls),
    }));
  };

  // Handler for auto-filling all team calls from sheet data
  const handleAutoFillTeamCalls = (callsMap: Record<string, number>) => {
    setTeamCalls((prev) => ({
      ...prev,
      ...callsMap,
    }));
  };

  // Handler for clearing all team calls
  const handleClearTeamCalls = () => {
    const activeTeam = getSalespeopleForDateRange(startDate, endDate);
    const cleared: Record<string, number> = { "Storage Team": 0 };
    activeTeam.forEach((p) => {
      cleared[p] = 0;
    });
    setTeamCalls(cleared);
  };

  // Matching records for the chosen filters
  const matchingRecords = useMemo(() => {
    return filterRecords(sheetRecords, salesperson, startDate, endDate);
  }, [sheetRecords, salesperson, startDate, endDate]);

  // Calculation Result
  const summary = useMemo(() => {
    return calculateMetrics(sheetRecords, {
      salesperson,
      startDate,
      endDate,
      numberOfCalls: currentSalespersonCalls,
      teamCalls,
    });
  }, [sheetRecords, salesperson, startDate, endDate, currentSalespersonCalls, teamCalls]);

  // PDF download handler
  const handleDownloadReport = () => {
    downloadPdfReport({
      summary,
      records: sheetRecords,
      individualMetrics: summary.individualMetrics,
    });
  };

  // Bounds
  const { minDate, maxDate } = useMemo(() => getDateBounds(sheetRecords), [sheetRecords]);

  // Synchronize team calls from sheet whenever date range or sheet records change
  const currentDateRangeRef = useRef<{ start: string; end: string }>({ start: startDate, end: endDate });
  const prevDateRangeRef = useRef<{ start: string; end: string }>({ start: startDate, end: endDate });
  const prevRecordsRef = useRef<SheetRecord[]>(sheetRecords);

  useEffect(() => {
    currentDateRangeRef.current = { start: startDate, end: endDate };
  }, [startDate, endDate]);

  useEffect(() => {
    if (!sheetRecords || sheetRecords.length === 0) return;

    const rangeChanged =
      prevDateRangeRef.current.start !== startDate || prevDateRangeRef.current.end !== endDate;
    const recordsChanged = prevRecordsRef.current !== sheetRecords;

    if (rangeChanged || recordsChanged) {
      prevDateRangeRef.current = { start: startDate, end: endDate };
      prevRecordsRef.current = sheetRecords;
      const { callsMap } = calculateSheetCallsForDateRange(sheetRecords, startDate, endDate);
      setTeamCalls(callsMap);
    }
  }, [startDate, endDate, sheetRecords]);

  // Live Sync Data Fetcher - uses currentDateRangeRef to prevent stale closure overwrites
  const syncData = useCallback(async (targetUrl: string = sheetUrl, silent: boolean = false) => {
    if (!silent) {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: null }));
    }
    try {
      const result = await fetchLiveSheetData(targetUrl);
      if (result.records && result.records.length > 0) {
        setSheetRecords(result.records);
        if (result.anomalies) {
          setAnomalies(result.anomalies);
        }
        prevRecordsRef.current = result.records;
        const activeStart = currentDateRangeRef.current.start;
        const activeEnd = currentDateRangeRef.current.end;
        const { callsMap } = calculateSheetCallsForDateRange(result.records, activeStart, activeEnd);
        setTeamCalls(callsMap);
        const bounds = getDateBounds(result.records);
        setSyncStatus({
          isSyncing: false,
          lastSyncedAt: new Date(),
          error: result.error || null,
          totalRows: result.records.length,
          sourceUrl: targetUrl,
          dateRangeInData: { start: bounds.minDate, end: bounds.maxDate },
        });
      } else {
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          error: "No records received from spreadsheet.",
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync error";
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: message,
      }));
    }
  }, [sheetUrl]);

  // Initial fetch on mount
  useEffect(() => {
    syncData(sheetUrl);
  }, [syncData, sheetUrl]);

  // Continuous Auto-Sync: Polls every 30 seconds and whenever the browser tab regains focus
  useEffect(() => {
    if (!autoSyncEnabled) return;

    // 1. Periodic background timer (every 30 seconds)
    const interval = setInterval(() => {
      syncData(sheetUrl, true);
    }, 30000);

    // 2. Immediate sync when user switches back to this tab from Google Sheets
    const handleFocus = () => {
      syncData(sheetUrl, true);
    };

    // 3. When page visibility changes back to visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncData(sheetUrl, true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncData, sheetUrl, autoSyncEnabled]);

  // Change Salesperson handler
  const handleSelectSalesperson = (name: string) => {
    setSalesperson(name);
  };

  // Change Date range handler (falls back to 1st of current month to today if cleared)
  const handleDateChange = (start: string, end: string) => {
    let targetStart = normalizeAndResolveDate(start, sheetRecords);
    let targetEnd = normalizeAndResolveDate(end, sheetRecords);
    if (!targetStart && !targetEnd) {
      targetStart = getDefaultDateRange().startDate;
      targetEnd = getDefaultDateRange().endDate;
    }
    setStartDate(targetStart);
    setEndDate(targetEnd);
    currentDateRangeRef.current = { start: targetStart, end: targetEnd };

    // Immediately calculate and set the exact calls done for this selected date range from the sheet
    if (sheetRecords && sheetRecords.length > 0) {
      const { callsMap } = calculateSheetCallsForDateRange(sheetRecords, targetStart, targetEnd);
      setTeamCalls(callsMap);
      prevDateRangeRef.current = { start: targetStart, end: targetEnd };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans antialiased selection:bg-zinc-900 selection:text-white">
      {/* Top Header */}
      <Header
        syncStatus={syncStatus}
        onRefresh={() => syncData(sheetUrl)}
        onDownloadReport={handleDownloadReport}
      />

      {/* Main Container - Single Unified View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* 1. Monthly Sales Comparison & Trajectory (Line Graph) */}
        <section aria-label="Monthly Sales Comparison">
          <MonthlyComparisonChart
            records={sheetRecords}
            salesperson={salesperson}
            startDate={startDate}
            endDate={endDate}
            anomalies={anomalies}
          />
        </section>

        {/* 2. Executive Selector */}
        <section aria-label="Executive Selection">
          <SalespersonSelector
            selectedSalesperson={salesperson}
            onSelect={handleSelectSalesperson}
            allRecords={sheetRecords}
            startDate={startDate}
            endDate={endDate}
          />
        </section>

        {/* 3. Date Range & Quick Presets (Directly below Salesperson Selection) */}
        <section aria-label="Date Range Controls">
          <DateRangeControls
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            minDate={minDate}
            maxDate={maxDate}
          />
        </section>

        {/* 4. Calls Done Input (Whole Team per-salesperson breakdown or focused individual) */}
        <section aria-label="Call Volume Input">
          <CallInputControl
            salesperson={salesperson}
            numberOfCalls={currentSalespersonCalls}
            onCallsChange={handleCallsChange}
            matchingSheetRecords={matchingRecords}
            allRecords={sheetRecords}
            teamCalls={teamCalls}
            onIndividualCallChange={handleIndividualCallChange}
            onAutoFillTeamCalls={handleAutoFillTeamCalls}
            onClearTeamCalls={handleClearTeamCalls}
            startDate={startDate}
            endDate={endDate}
          />
        </section>

        {/* 5. Primary Key Sales Metrics (Total Deal Sales, Total Commission, Closed Deals, Avg Deal Value) */}
        <section aria-label="Primary Key Metrics">
          <PrimaryMetricCards summary={summary} />
        </section>

        {/* 6. Daily Performance Timeline (Visual Trend Chart) */}
        <section aria-label="Daily Performance Timeline">
          <VisualChart
            records={sheetRecords}
            salesperson={salesperson}
            startDate={startDate}
            endDate={endDate}
            anomalies={anomalies}
          />
        </section>

        {/* 7. Revenue Generated per Call & AA Commission per Call */}
        <section aria-label="Call Yield & Commission Rates">
          <CallYieldCards summary={summary} />
        </section>

        {/* 8. Call Economics, Movement Type Distribution & Target Simulator */}
        <section aria-label="Efficiency Analytics & Simulator">
          <EfficiencyAnalytics summary={summary} />
        </section>

        {/* 9. Client Origin Heat Map (India) - Column K Analysis */}
        <section aria-label="India Client Origin Heat Map">
          <IndiaOriginHeatMap
            records={sheetRecords}
            activeRepFilter={salesperson}
          />
        </section>

        {/* 10. Collapsible Detailed Sheet Records Log */}
        <section aria-label="Sheet Records Explorer" className="pt-2">
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setShowRawTable(!showRawTable)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800 group-hover:bg-zinc-200 transition-colors">
                  <TableIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 group-hover:text-zinc-700 transition-colors">
                    Detailed Sheet Records Log ({matchingRecords.length} entries)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Click to {showRawTable ? "hide" : "expand"} itemized row data for {salesperson === "All" ? "Whole Team" : salesperson}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-xl border border-zinc-200 transition-colors">
                <span>{showRawTable ? "Hide Records" : "View Records"}</span>
                {showRawTable ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {showRawTable && (
              <div className="mt-6 pt-6 border-t border-zinc-100 animate-in fade-in duration-200">
                <DailyRecordsTable
                  records={sheetRecords}
                  salesperson={salesperson}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 mt-12 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Sales Call Revenue & Commission Analyzer • Live Synced with Google Sheets
          </span>
          <span className="text-zinc-400">
            Sales Reps: Shruti • Vaishnavi • Nidhi • Prithviraj • Rutuja (Active team from Oct 2026)
          </span>
        </div>
      </footer>
    </div>
  );
}
