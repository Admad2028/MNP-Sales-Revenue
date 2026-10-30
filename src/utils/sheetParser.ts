import { SheetRecord, AnomalyRecord } from "../types";
import { INITIAL_SHEET_RECORDS } from "../data/initialSheetData";

export const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1hIGJm0wYxgD7Q-SWXAtjRZBzxOE8Q7xVofKHg6Q1P1U/edit?usp=sharing";

// Active sales team members from October 2026 onwards (Rutuja joined in October; Meghna left from September)
export const ACTIVE_SALESPEOPLE = [
  "Shruti",
  "Vaishnavi",
  "Nidhi",
  "Prithviraj",
  "Rutuja"
] as const;

// September 2026 sales team (Meghna left, prior to Rutuja joining)
export const SEPTEMBER_SALESPEOPLE = [
  "Shruti",
  "Vaishnavi",
  "Nidhi",
  "Prithviraj"
] as const;

// Historical team prior to September 2026 (for historical records in July/August)
export const HISTORICAL_SALESPEOPLE = [
  "Meghna",
  "Shruti",
  "Vaishnavi",
  "Nidhi",
  "Prithviraj"
] as const;

// Default active salespeople
export const DEFAULT_SALESPEOPLE = ACTIVE_SALESPEOPLE;

/**
 * Returns the relevant sales team members for a given date range.
 * - From October 2026 onwards (startDate >= '2026-10-01' or default view): Rutuja joined the team alongside Shruti, Vaishnavi, Nidhi, Prithviraj.
 * - For September 2026 (startDate >= '2026-09-01' and endDate < '2026-10-01'): Meghna had left and Rutuja had not yet joined (Shruti, Vaishnavi, Nidhi, Prithviraj).
 * - For dates strictly before September 2026 (endDate < '2026-09-01'): Meghna is included (Meghna, Shruti, Vaishnavi, Nidhi, Prithviraj).
 * - For multi-month spans: dynamically includes Meghna if spanning before Sep 2026, and Rutuja if spanning into Oct 2026.
 * - Also dynamically discovers any salesperson who has records in the specified date range.
 */
export function getSalespeopleForDateRange(
  startDate?: string,
  endDate?: string,
  records?: SheetRecord[]
): string[] {
  const list: string[] = [];

  // If default view or both blank, return active team from October onwards
  if (!startDate && !endDate) {
    list.push("Shruti", "Vaishnavi", "Nidhi", "Prithviraj", "Rutuja");
  } else {
    // Meghna was present before September 2026
    if (startDate && startDate < "2026-09-01") {
      list.push("Meghna");
    } else if (!startDate && endDate && endDate < "2026-09-01") {
      list.push("Meghna");
    }

    // Core team present across all periods
    list.push("Shruti", "Vaishnavi", "Nidhi", "Prithviraj");

    // Rutuja joined from October 2026 onwards
    if (endDate && endDate >= "2026-10-01") {
      list.push("Rutuja");
    } else if (startDate && startDate >= "2026-10-01") {
      list.push("Rutuja");
    }
  }

  // Also dynamically include any salesperson who has records in the provided date range
  if (records && records.length > 0) {
    records.forEach((r) => {
      if (!r.executive) return;
      const name = r.executive.trim();
      if (!name || name.toLowerCase() === "all" || name.toLowerCase() === "storage team") return;
      if (startDate && r.date < startDate) return;
      if (endDate && r.date > endDate) return;

      if (!list.includes(name)) {
        list.push(name);
      }
    });
  }

  return list;
}

export const SALESPERSON_COLORS: Record<string, { bg: string; text: string; border: string; badge: string; gradient: string }> = {
  Meghna: {
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    text: "text-emerald-700",
    border: "border-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    gradient: "from-emerald-600 to-teal-700"
  },
  Shruti: {
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    text: "text-indigo-700",
    border: "border-indigo-500",
    badge: "bg-indigo-100 text-indigo-800",
    gradient: "from-indigo-600 to-blue-700"
  },
  Vaishnavi: {
    bg: "bg-violet-50 text-violet-700 border-violet-200",
    text: "text-violet-700",
    border: "border-violet-500",
    badge: "bg-violet-100 text-violet-800",
    gradient: "from-violet-600 to-purple-700"
  },
  Nidhi: {
    bg: "bg-amber-50 text-amber-700 border-amber-200",
    text: "text-amber-700",
    border: "border-amber-500",
    badge: "bg-amber-100 text-amber-800",
    gradient: "from-amber-600 to-orange-700"
  },
  Prithviraj: {
    bg: "bg-rose-50 text-rose-700 border-rose-200",
    text: "text-rose-700",
    border: "border-rose-500",
    badge: "bg-rose-100 text-rose-800",
    gradient: "from-rose-600 to-pink-700"
  },
  Rutuja: {
    bg: "bg-cyan-50 text-cyan-700 border-cyan-200",
    text: "text-cyan-700",
    border: "border-cyan-500",
    badge: "bg-cyan-100 text-cyan-800",
    gradient: "from-cyan-600 to-blue-700"
  },
  "Storage Team": {
    bg: "bg-slate-50 text-slate-700 border-slate-200",
    text: "text-slate-700",
    border: "border-slate-500",
    badge: "bg-slate-100 text-slate-800",
    gradient: "from-slate-600 to-gray-700"
  },
  All: {
    bg: "bg-blue-50 text-blue-700 border-blue-200",
    text: "text-blue-700",
    border: "border-blue-500",
    badge: "bg-blue-100 text-blue-800",
    gradient: "from-blue-600 to-indigo-700"
  }
};

/**
 * Extracts the Google Sheet ID from any standard Google Spreadsheet URL
 */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Converts various date formats (DD/MM/YYYY, YYYY-MM-DD, 7-Sep, 07-Sep-2026, etc.) into YYYY-MM-DD
 */
export function parseDateToISO(raw: string, defaultYear: number = 2026): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const monthMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    sept: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  // Check text month like "7-Sep", "07-Sep", "7-Sep-2026", "7 Sep 2026", "7-Sep-26"
  const textMonthMatch = trimmed.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})(?:[-/ ](\d{2,4}))?$/);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, "0");
    const mStr = textMonthMatch[2].toLowerCase().slice(0, 3);
    const month = monthMap[mStr] || "09";
    let year = textMonthMatch[3] || String(defaultYear);
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }

  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, "0");
    let month = parts[1].padStart(2, "0");
    let year = parts[2];
    if (year.length === 2) year = "20" + year;
    // Check if format might be YYYY/MM/DD
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1].padStart(2, "0");
      day = parts[2].padStart(2, "0");
    }
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

/**
 * Parses raw CSV text from the "Anomalies" sub-sheet
 */
export function parseAnomaliesCSV(csvText: string): AnomalyRecord[] {
  if (!csvText || csvText.trim().length === 0) return [];
  const rows = parseCSV(csvText);
  if (rows.length <= 1) return [];

  const header = rows[0].map((h) => (h || "").trim().toLowerCase());

  const findIdx = (predicate: (h: string) => boolean, defaultIdx: number): number => {
    const idx = header.findIndex(predicate);
    return idx >= 0 ? idx : defaultIdx;
  };

  const srIdx = findIdx((h) => h.includes("sr") || h.includes("serial") || h.includes("no"), 0);
  const dateIdx = findIdx((h) => h === "date" || (h.includes("date") && !h.includes("end")), 1);
  const endDateIdx = findIdx((h) => h.includes("end"), 2);
  const anomalyIdx = findIdx(
    (h) => h.includes("anomaly") || h.includes("issue") || h.includes("event") || h.includes("reason"),
    3
  );
  const remarksIdx = findIdx((h) => h.includes("remark") || h.includes("note") || h.includes("desc"), 4);
  const affectedIdx = findIdx(
    (h) => h.includes("affect") || h.includes("who") || h.includes("rep") || h.includes("team"),
    5
  );

  const anomalies: AnomalyRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const rawStartDate = (r[dateIdx] || "").trim();
    const anomaly = (r[anomalyIdx] || "").trim();
    if (!rawStartDate && !anomaly) continue;

    const serialNo = (r[srIdx] || `${i}`).trim();
    const rawEndDate = (r[endDateIdx] || "").trim();
    const remarks = (r[remarksIdx] || "").trim();
    const affected = (r[affectedIdx] || "Whole Team").trim();

    const startDate = parseDateToISO(rawStartDate);
    const endDate = rawEndDate ? parseDateToISO(rawEndDate) : startDate;

    if (!startDate) continue;

    anomalies.push({
      id: `anomaly-${serialNo || i}`,
      serialNo,
      startDate,
      endDate: endDate || startDate,
      rawStartDate,
      rawEndDate: rawEndDate || rawStartDate,
      anomaly: anomaly || "Operational Anomaly",
      remarks,
      affected: affected || "Whole Team",
    });
  }

  return anomalies;
}

/**
 * Robust CSV parser supporting quotes, commas within fields, and newlines
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Helper to add 1 day to a YYYY-MM-DD ISO date string
 */
export function incrementDayISO(isoDate: string): string {
  if (!isoDate || !isoDate.includes("-")) return isoDate;
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3) return isoDate;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(d.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Extracts exact row dates from Google Sheet HTML with full support for merged cells (rowspan)
 */
export function extractHtmlRowDates(htmlText: string): string[] {
  const trMatches = [...htmlText.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((m) => m[1]);
  const rowDates: string[] = [];
  let pendingRowspan = { count: 0, val: "" };

  const validExecs = ["meghna", "shruti", "prithviraj", "vaishnavi", "nidhi", "rutuja", "storage team"];

  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<td([^>]*)>(.*?)<\/td>/gs)].map((m) => {
      const attrs = m[1];
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      const rowspanMatch = attrs.match(/rowspan="(\d+)"/);
      const rowspan = rowspanMatch ? parseInt(rowspanMatch[1], 10) : 1;
      return { text, rowspan };
    });

    if (cells.length === 0) continue;

    let dateVal = "";
    let cellOffset = 0;

    const firstCell = cells[0];
    const dateMatch = firstCell ? firstCell.text.match(/^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})$/) : null;

    if (dateMatch) {
      dateVal = dateMatch[1];
      if (firstCell.rowspan > 1) {
        pendingRowspan = { count: firstCell.rowspan - 1, val: dateVal };
      }
      cellOffset = 1;
    } else if (pendingRowspan.count > 0) {
      dateVal = pendingRowspan.val;
      pendingRowspan.count--;
      cellOffset = 0;
    }

    const execCell = cells[cellOffset];
    const execName = execCell ? execCell.text : "";

    if (validExecs.some((ve) => execName.toLowerCase().startsWith(ve))) {
      rowDates.push(dateVal);
    }
  }
  return rowDates;
}

/**
 * Dynamic column index detector that maps column names for August, July, September, and future month formats
 */
export interface DetectedColumns {
  dateIdx: number;
  execIdx: number;
  dialledIdx: number; // Col C in Sept+: "No of Dialled Calls" or "No. of Leads Allocated"
  connectedIdx: number; // Col D in Sept+: "No of Connected Calls"
  spamIdx: number;
  genuineIdx: number;
  pendingIdx: number;
  prospectsIdx: number;
  dealsClosedIdx: number;
  movementIdx: number;
  originCityIdx: number; // "Origin City"
  dealAmountIdx: number;
  commIdx: number;
  commPctIdx: number;
  remarksIdx: number;
}

export function detectColumnIndices(headerRow: string[] = []): DetectedColumns {
  const norm = headerRow.map((h) => (h || "").trim().toLowerCase());

  const findIdx = (predicate: (h: string) => boolean, defaultIdx: number): number => {
    const idx = norm.findIndex(predicate);
    return idx >= 0 ? idx : defaultIdx;
  };

  const dateIdx = findIdx((h) => h.includes("date"), 0);
  const execIdx = findIdx((h) => h.includes("exec") || h.includes("rep") || h.includes("name"), 1);
  
  // Dialled calls / leads allocated (Col C: "No of Dialled Calls", "No. of Leads Allocated", or column index 2)
  const dialledIdx = findIdx(
    (h) =>
      h.includes("dial") ||
      h.includes("calls done") ||
      h.includes("call") ||
      h.includes("allocated") ||
      h.includes("lead"),
    2
  );

  // Connected Calls (Col D in Sept: "No of Connected Calls")
  const connectedIdx = findIdx((h) => h.includes("connected") || h.includes("connect"), -1);
  
  // Spam / Not Interested / Did Not Pick Up
  const spamIdx = findIdx((h) => h.includes("spam") || h.includes("not interested") || h.includes("pick up"), 3);
  
  // Genuine Interested Client Calls
  const genuineIdx = findIdx((h) => h.includes("genuine") || h.includes("interested client"), 4);
  
  // Pending leads
  const pendingIdx = findIdx((h) => h.includes("pending"), 5);
  
  // Prospects created
  const prospectsIdx = findIdx((h) => h.includes("prospect"), 6);
  
  // Deals closed
  const dealsClosedIdx = findIdx(
    (h) => h.includes("deals closed") || (h.includes("deal") && h.includes("close")) || (h.includes("deal") && h.includes("won")),
    7
  );
  
  // Movement Type
  const movementIdx = findIdx((h) => h.includes("movement"), 8);
  
  // Origin City
  const originCityIdx = findIdx((h) => h.includes("origin") || h.includes("city"), -1);
  
  // Deal Amount
  const dealAmountIdx = findIdx(
    (h) => (h.includes("deal") && h.includes("amount")) || (h.includes("amount") && !h.includes("commission")) || h.includes("revenue") || h.includes("deal value"),
    9
  );
  
  // AA Commission
  const commIdx = findIdx(
    (h) => (h.includes("commission") || h.includes("comm")) && !h.includes("%") && !h.includes("percent"),
    10
  );
  
  // Commission Percentage
  const commPctIdx = findIdx((h) => h.includes("%") || h.includes("percent"), 11);
  
  // Remarks
  const remarksIdx = findIdx((h) => h.includes("remark") || h.includes("note"), 12);

  return {
    dateIdx,
    execIdx,
    dialledIdx,
    connectedIdx,
    spamIdx,
    genuineIdx,
    pendingIdx,
    prospectsIdx,
    dealsClosedIdx,
    movementIdx,
    originCityIdx,
    dealAmountIdx,
    commIdx,
    commPctIdx,
    remarksIdx,
  };
}

/**
 * Returns year and month number based on tab name (e.g. September -> { year: 2026, month: 9, monthStr: "09" })
 */
export function getMonthInfoFromTabName(tabName?: string): { year: number; month: number; monthStr: string } {
  if (!tabName) return { year: 2026, month: 8, monthStr: "08" };
  const lower = tabName.toLowerCase().trim();
  const months = [
    { names: ["jan", "january"], m: 1, str: "01" },
    { names: ["feb", "february"], m: 2, str: "02" },
    { names: ["mar", "march"], m: 3, str: "03" },
    { names: ["apr", "april"], m: 4, str: "04" },
    { names: ["may"], m: 5, str: "05" },
    { names: ["jun", "june"], m: 6, str: "06" },
    { names: ["jul", "july"], m: 7, str: "07" },
    { names: ["aug", "august"], m: 8, str: "08" },
    { names: ["sep", "sept", "september"], m: 9, str: "09" },
    { names: ["oct", "october"], m: 10, str: "10" },
    { names: ["nov", "november"], m: 11, str: "11" },
    { names: ["dec", "december"], m: 12, str: "12" },
  ];
  const found = months.find((item) => item.names.some((n) => lower.startsWith(n)));
  if (found) {
    return { year: 2026, month: found.m, monthStr: found.str };
  }
  return { year: 2026, month: 8, monthStr: "08" };
}

/**
 * Parses 2D CSV array into typed SheetRecord objects with dynamic header detection,
 * cycle-based date inheritance, calendar alignment, and multi-subsheet support.
 */
export function parseCSVToSheetRecords(
  rawRows: string[][],
  overrideDates?: string[],
  tabName?: string
): SheetRecord[] {
  if (rawRows.length <= 1) return [];

  // Detect dynamic column indices from header row
  const cols = detectColumnIndices(rawRows[0] || []);

  const records: SheetRecord[] = [];
  let lastSeenIsoDate = "";
  let lastSeenRawDate = "";

  const monthInfo = getMonthInfoFromTabName(tabName);

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const exec = (row[cols.execIdx] || "").trim();
    
    // If no salesperson name, skip empty/marker rows (like headers, total rows, or spacer lines)
    if (!exec || exec.toLowerCase() === "executive name" || exec.toLowerCase() === "total" || exec.toLowerCase() === "executive") {
      continue;
    }

    // Handle date field:
    let dateVal = (row[cols.dateIdx] || "").trim();
    
    // If Column A is populated and has numbers/delimiters, update our last seen date
    if (dateVal && /^\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(dateVal)) {
      lastSeenRawDate = dateVal;
      lastSeenIsoDate = parseDateToISO(dateVal);
    } else if (overrideDates && overrideDates[i - 1]) {
      // fallback to override dates if available and we don't have a direct date in the row
      const overrideVal = overrideDates[i - 1].trim();
      if (overrideVal && /^\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(overrideVal)) {
        lastSeenRawDate = overrideVal;
        lastSeenIsoDate = parseDateToISO(overrideVal);
      }
    }

    // If we still don't have a date (should only happen at the very beginning of a sheet),
    // default to the month's first day
    if (!lastSeenIsoDate) {
      lastSeenIsoDate = `${monthInfo.year}-${monthInfo.monthStr}-01`;
      lastSeenRawDate = `01/${monthInfo.monthStr}/${monthInfo.year}`;
    }

    const rawColC = cols.dialledIdx >= 0 ? parseFloat(row[cols.dialledIdx]) || 0 : 0;
    const dialledCalls = rawColC > 0 ? rawColC : 0;
    const connectedCalls = cols.connectedIdx >= 0 ? parseFloat(row[cols.connectedIdx]) || 0 : undefined;
    const leadsAllocated = rawColC;
    const spamEtc = cols.spamIdx >= 0 ? parseFloat(row[cols.spamIdx]) || 0 : 0;
    const genuineCalls = cols.genuineIdx >= 0 ? parseFloat(row[cols.genuineIdx]) || 0 : 0;
    const pendingLeads = cols.pendingIdx >= 0 ? parseFloat(row[cols.pendingIdx]) || 0 : 0;
    const prospects = cols.prospectsIdx >= 0 ? parseFloat(row[cols.prospectsIdx]) || 0 : 0;
    const dealsClosed = cols.dealsClosedIdx >= 0 ? parseFloat(row[cols.dealsClosedIdx]) || 0 : 0;
    const movementType = cols.movementIdx >= 0 ? (row[cols.movementIdx] || "").trim() : "";
    const originCity = cols.originCityIdx >= 0 ? (row[cols.originCityIdx] || "").trim() : undefined;
    const dealAmount =
      cols.dealAmountIdx >= 0
        ? parseFloat((row[cols.dealAmountIdx] || "0").replace(/[^0-9.-]/g, "")) || 0
        : 0;
    const aaCommission =
      cols.commIdx >= 0
        ? parseFloat((row[cols.commIdx] || "0").replace(/[^0-9.-]/g, "")) || 0
        : 0;
    const aaCommissionPercentage = cols.commPctIdx >= 0 ? (row[cols.commPctIdx] || "").trim() : "";
    const remarks = cols.remarksIdx >= 0 ? (row[cols.remarksIdx] || "").trim() : "";

    records.push({
      id: `sheet-${(tabName || "row").toLowerCase()}-${i}`,
      date: lastSeenIsoDate,
      rawDate: lastSeenRawDate,
      executive: exec,
      dialledCalls,
      connectedCalls,
      leadsAllocated,
      spamEtc,
      genuineCalls,
      pendingLeads,
      prospects,
      dealsClosed,
      movementType,
      originCity,
      dealAmount,
      aaCommission,
      aaCommissionPercentage,
      remarks,
    });
  }

  return records;
}

/**
 * Fetches anomalies directly from the Anomalies sub-sheet via GVIZ CSV endpoint
 */
export async function fetchAnomaliesData(sheetId: string): Promise<AnomalyRecord[]> {
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Anomalies`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const csvText = await res.text();
      if (
        csvText.trim().length > 10 &&
        !csvText.includes("INVALID_SHEET_NAME") &&
        !csvText.includes("<html>")
      ) {
        return parseAnomaliesCSV(csvText);
      }
    }
  } catch (err) {
    console.warn("Could not fetch Anomalies sub-sheet directly:", err);
  }
  return [];
}

/**
 * Fetches Sheet records by trying backend proxy first, then direct endpoints
 */
export async function fetchLiveSheetData(
  sheetUrl: string = DEFAULT_SHEET_URL
): Promise<{ records: SheetRecord[]; anomalies: AnomalyRecord[]; isLive: boolean; error?: string }> {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    return {
      records: INITIAL_SHEET_RECORDS,
      anomalies: [],
      isLive: false,
      error: "Invalid Google Sheet link. Falling back to cached data.",
    };
  }

  // 1. Try server backend API endpoint (fetches and combines all discovered subsheets + anomalies)
  try {
    const apiRes = await fetch(`/api/sheet-data?url=${encodeURIComponent(sheetUrl)}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.records && Array.isArray(data.records) && data.records.length > 0) {
        return {
          records: data.records,
          anomalies: Array.isArray(data.anomalies) ? data.anomalies : [],
          isLive: true,
        };
      }
    }
  } catch {
    // Ignore server error and try client fallback
  }

  // Fetch anomalies in parallel with client candidate tabs
  const clientAnomaliesPromise = fetchAnomaliesData(sheetId);

  // 2. Direct client fallback across month subsheets
  // First attempt: try discovering tabs and GIDs via htmlview directly for real-time un-cached data
  try {
    const htmlRes = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`);
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const regex = /items\.push\(\{[^}]*name:\s*"([^"]+)"[^}]*gid:\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      const clientTabMap: Array<{ name: string; gid: string }> = [];
      while ((m = regex.exec(html)) !== null) {
        clientTabMap.push({ name: m[1].trim(), gid: m[2].trim() });
      }

      if (clientTabMap.length > 0) {
        const clientExportPromises = clientTabMap.map(async ({ name, gid }) => {
          try {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
            const res = await fetch(exportUrl);
            if (res.ok) {
              const csvText = await res.text();
              if (name.toLowerCase().includes("anomal")) {
                return { type: "anomalies", anomalies: parseAnomaliesCSV(csvText) };
              } else if (csvText.trim().length > 30) {
                const rows = parseCSV(csvText);
                const records = parseCSVToSheetRecords(rows, undefined, name);
                if (records.length > 0) {
                  return { type: "records", records, tab: name };
                }
              }
            }
          } catch {
            // ignore
          }
          return null;
        });

        const exportResults = await Promise.all(clientExportPromises);
        const exportRecords: SheetRecord[] = [];
        let exportAnomalies: AnomalyRecord[] = [];
        for (const res of exportResults) {
          if (!res) continue;
          if (res.type === "records" && res.records) {
            res.records.forEach((r, idx) => {
              exportRecords.push({
                ...r,
                id: `sheet-${res.tab!.toLowerCase()}-row-${idx + 1}`,
              });
            });
          } else if (res.type === "anomalies" && res.anomalies) {
            exportAnomalies = res.anomalies;
          }
        }

        if (exportRecords.length > 0) {
          exportRecords.sort((a, b) => a.date.localeCompare(b.date));
          return {
            records: exportRecords,
            anomalies: exportAnomalies.length > 0 ? exportAnomalies : await clientAnomaliesPromise,
            isLive: true,
          };
        }
      }
    }
  } catch {
    // Continue to GVIZ fallback
  }

  // Fallback candidate tabs using GVIZ
  const candidateTabs = [
    "August",
    "July",
    "September",
    "October",
    "November",
    "December",
    "June",
    "May",
    "April",
    "March",
    "February",
    "January",
  ];

  try {
    const allRecords: SheetRecord[] = [];
    await Promise.all(
      candidateTabs.map(async (tab) => {
        try {
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
            tab
          )}`;
          const res = await fetch(gvizUrl);
          if (res.ok) {
            const csvText = await res.text();
            if (
              csvText.trim().length > 30 &&
              !csvText.includes("INVALID_SHEET_NAME") &&
              !csvText.includes("<html>")
            ) {
              const rows = parseCSV(csvText);
              const records = parseCSVToSheetRecords(rows, undefined, tab);
              if (records.length > 0) {
                records.forEach((r, idx) => {
                  allRecords.push({
                    ...r,
                    id: `sheet-${tab.toLowerCase()}-row-${idx + 1}`,
                  });
                });
              }
            }
          }
        } catch {
          // ignore single tab error
        }
      })
    );

    const clientAnomalies = await clientAnomaliesPromise;

    if (allRecords.length > 0) {
      allRecords.sort((a, b) => a.date.localeCompare(b.date));
      return {
        records: allRecords,
        anomalies: clientAnomalies,
        isLive: true,
      };
    }
  } catch {
    // try default export next
  }

  // 3. Try default primary Google CSV export
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const res = await fetch(csvUrl);
    if (res.ok) {
      const csvText = await res.text();
      const rows = parseCSV(csvText);
      const parsed = parseCSVToSheetRecords(rows);
      const clientAnomalies = await clientAnomaliesPromise;
      if (parsed.length > 0) {
        return {
          records: parsed,
          anomalies: clientAnomalies,
          isLive: true,
        };
      }
    }
  } catch {
    // Fall back to bundled data
  }

  // Fallback to embedded initial data (contains both July and August)
  return {
    records: INITIAL_SHEET_RECORDS,
    anomalies: [],
    isLive: false,
    error: "Could not connect to live Google Sheet (CORS/Network). Using verified local dataset.",
  };
}

/**
 * Currency formatter for INR
 */
export function formatINR(amount: number, decimals: number = 0): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "₹0";
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Returns a date string in YYYY-MM-DD for Indian Standard Time (IST - Asia/Kolkata)
 * offsetDays allows getting yesterday (-1), today (0), or last 7 days (-6)
 */
export function getISTDateString(offsetDays: number = 0): string {
  const now = new Date();
  
  // Format current timestamp into Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const istDateStr = formatter.format(now); // e.g. "2026-08-20"
  
  if (offsetDays === 0) {
    return istDateStr;
  }
  
  const [year, month, day] = istDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dt = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dt}`;
}

/**
 * Returns the default date range: 1st of the current month to today's date (IST)
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = getISTDateString(0);
  const [yearStr, monthStr] = today.split("-");
  const startDate = `${yearStr}-${monthStr.padStart(2, "0")}-01`;
  const endDate = today;
  return { startDate, endDate };
}

/**
 * Format Date display as DD/MM/YYYY or DD/MM/YY
 */
export function formatDateDDMMYY(isoDate: string): string {
  if (!isoDate) return "-";
  try {
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, "0");
      const day = parts[2].padStart(2, "0");
      return `${day}/${month}/${year}`;
    }
    return isoDate;
  } catch {
    return isoDate;
  }
}

/**
 * Format Date display (DD/MM/YYYY)
 */
export function formatDateDisplay(isoDate: string): string {
  return formatDateDDMMYY(isoDate);
}

/**
 * Format Date as short readable string, e.g. "25 Aug" or "25 Aug 2026"
 */
export function formatDateShort(isoDate: string, includeYear = false): string {
  if (!isoDate) return "-";
  try {
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const temp = new Date(year, month - 1, day);
      const monthName = temp.toLocaleString("en-US", { month: "short" });
      const dayStr = String(day).padStart(2, "0");
      return includeYear ? `${dayStr} ${monthName} ${year}` : `${dayStr} ${monthName}`;
    }
    return isoDate;
  } catch {
    return isoDate;
  }
}

/**
 * Generate consecutive calendar dates array (YYYY-MM-DD) between start and end inclusive
 */
export function getDatesInRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const [sYear, sMonth, sDay] = start.split("-").map(Number);
  const [eYear, eMonth, eDay] = end.split("-").map(Number);
  const curr = new Date(sYear, sMonth - 1, sDay);
  const last = new Date(eYear, eMonth - 1, eDay);

  if (curr > last) return [start];

  while (curr <= last) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, "0");
    const d = String(curr.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Get equivalent comparison date in the previous month (e.g. 2026-08-15 -> 2026-07-15)
 */
export function getPreviousMonthDate(isoDate: string): string {
  if (!isoDate) return "";
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  // Clamp day to max days in prior month
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, daysInPrevMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * Smart date resolver to handle potential MM/DD vs DD/MM input mixups.
 * If a date like "2026-02-09" was entered (where month is 02 and day is 09), but the sheet has no records
 * for "2026-02-09" and has records for "2026-09-02", it swaps them to ensure the user gets their intended date!
 */
export function normalizeAndResolveDate(dateStr: string, records?: SheetRecord[]): string {
  if (!dateStr) return dateStr;
  const trimmed = dateStr.trim();
  if (!records || records.length === 0) return trimmed;

  const parts = trimmed.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    // If month and day are both <= 12 and different, check if swapping matches actual records
    if (month <= 12 && day <= 12 && month !== day) {
      const origHasRecords = records.some((r) => r.date === trimmed);
      if (!origHasRecords) {
        const swapped = `${year}-${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`;
        const swappedHasRecords = records.some((r) => r.date === swapped);
        if (swappedHasRecords) {
          return swapped;
        }
      }
    }
  }
  return trimmed;
}

